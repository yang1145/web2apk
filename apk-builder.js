const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

class ApkBuilder {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp');
    this.buildsDir = path.join(__dirname, 'builds');
    this.gradleLibPath = path.join(__dirname, 'lib', 'gradle-7.0-bin.zip');
    this.ensureDirectories();
  }

  ensureDirectories() {
    try {
      fs.ensureDirSync(this.tempDir);
      fs.ensureDirSync(this.buildsDir);
      fs.ensureDirSync(path.join(__dirname, 'assets'));
      fs.ensureDirSync(path.join(__dirname, 'uploads'));
    } catch (error) {
      throw new Error('无法创建必要的工作目录: ' + error.message);
    }
  }

  async processAppIcon(iconFile, packageName) {
    if (!iconFile) {
      // 使用默认图标
      const defaultIcon = path.join(__dirname, 'assets', 'default-icon.png');
      if (await fs.pathExists(defaultIcon)) {
        return this.resizeAppIcon(defaultIcon, packageName);
      }
      return null;
    }

    return this.resizeAppIcon(iconFile.path, packageName);
  }

  async resizeAppIcon(iconPath, packageName) {
    const iconSizes = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 }
    ];

    const iconPromises = iconSizes.map(async ({ dir, size }) => {
      const resizedIconDir = path.join(this.tempDir, packageName, 'app', 'src', 'main', 'res', dir);
      await fs.ensureDir(resizedIconDir);
      const outputPath = path.join(resizedIconDir, 'ic_launcher.png');
      
      try {
        await sharp(iconPath)
          .resize(size, size)
          .png()
          .toFile(outputPath);
      } catch (error) {
        throw new Error('处理应用图标时出错 (' + dir + '): ' + error.message);
      }
      
      return outputPath;
    });

    await Promise.all(iconPromises);
    return true;
  }

  async prepareWebContent(webDirectory, packageName, mainPage) {
    // 为Capacitor准备web目录
    const webContentDir = path.join(this.tempDir, packageName, 'dist');
    await fs.ensureDir(webContentDir);

    if (webDirectory && webDirectory.length > 0) {
      // 复制上传的网页目录
      try {
        // 创建一个映射来跟踪目录结构
        const pathMap = new Map();
        
        for (const file of webDirectory) {
          // 获取相对路径
          const relativePath = file.originalname || file.webkitRelativePath || file.name;
          const targetPath = path.join(webContentDir, relativePath);
          
          // 确保目标目录存在
          const targetDir = path.dirname(targetPath);
          await fs.ensureDir(targetDir);
          
          // 复制文件
          await fs.copy(file.path, targetPath);
        }
      } catch (error) {
        throw new Error('复制网页内容时出错: ' + error.message);
      }
    } else {
      // 创建默认网页内容
      const defaultHtml = 
'<!DOCTYPE html>' +
'<html>' +
'<head>' +
'    <meta charset="utf-8">' +
'    <meta name="viewport" content="width=device-width, initial-scale=1">' +
'    <title>' + packageName + '</title>' +
'</head>' +
'<body>' +
'    <div id="app">' +
'        <h1>欢迎使用 ' + packageName + '</h1>' +
'        <p>这是一个由网页转换的Android应用</p>' +
'    </div>' +
'</body>' +
'</html>';
      await fs.writeFile(path.join(webContentDir, mainPage), defaultHtml);
    }

    return webContentDir;
  }

  async generateAndroidProject(config) {
    const {
      appName,
      packageName,
      appVersion,
      versionCode,
      mainPage
    } = config;

    const projectDir = path.join(this.tempDir, packageName);
    await fs.ensureDir(projectDir);

    // 初始化Capacitor项目
    const oldCwd = process.cwd();
    process.chdir(projectDir);
    
    try {

      // 创建package.json
      const packageJson = {
        name: appName.toLowerCase().replace(/\s+/g, '-'),
        version: appVersion,
        description: 'Web to APK converted app',
        main: 'index.js',
        scripts: {
          build: 'echo "Build script"'
        },
        keywords: [],
        author: '',
        license: 'ISC'
      };
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // 安装Capacitor核心依赖
      console.log('正在安装Capacitor核心依赖...');
      try {
        execSync('npm install @capacitor/core @capacitor/cli', { stdio: 'inherit' });
      } catch (error) {
        throw new Error('安装Capacitor核心依赖失败: ' + error.message);
      }
      
      // 初始化Capacitor配置
      const capacitorConfig = {
        appId: packageName,
        appName: appName,
        webDir: 'dist',
        bundledWebRuntime: false
      };
      await fs.writeFile(path.join(projectDir, 'capacitor.config.json'), JSON.stringify(capacitorConfig, null, 2));

      // 安装Android平台支持
      console.log('正在安装Android平台支持...');
      try {
        execSync('npm install @capacitor/android', { stdio: 'inherit' });
      } catch (error) {
        throw new Error('安装Android平台支持失败: ' + error.message);
      }
      
      // 添加Android平台
      console.log('正在添加Android平台...');
      try {
        execSync('npx cap add android', { stdio: 'inherit' });
      } catch (error) {
        throw new Error('添加Android平台失败: ' + error.message);
      }
      
      // 配置使用本地Gradle或阿里云镜像
      console.log('正在配置Gradle...');
      await this.configureGradle(projectDir);
      
      return projectDir;
    } finally {
      process.chdir(oldCwd);
    }
  }

  async configureGradle(projectDir) {
    try {
      const androidDir = path.join(projectDir, 'android');
      
      // 创建或更新allprojects repositories
      const buildGradlePath = path.join(androidDir, 'build.gradle');
      let buildGradleContent = await fs.readFile(buildGradlePath, 'utf8');
      
      // 替换repositories部分为标准仓库
      const repositoriesConfig = `repositories {
        google()
        mavenCentral()
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/central' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
    }`;
      
      buildGradleContent = buildGradleContent.replace(
        /repositories\s*{[^}]*}/g,
        repositoriesConfig
      );
      
      // 同样替换allprojects部分
      if (buildGradleContent.includes('allprojects')) {
        buildGradleContent = buildGradleContent.replace(
          /allprojects\s*{[\s\S]*?repositories\s*{[^}]*}}/,
          `allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/central' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
    }
}`
        );
      }
      
      await fs.writeFile(buildGradlePath, buildGradleContent);
      
      // 创建gradle.properties文件
      const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
      let gradlePropertiesContent = `android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
`;

      // 检查本地Gradle文件是否存在，如果存在则使用离线模式
      if (await fs.pathExists(this.gradleLibPath)) {
        console.log('检测到本地Gradle文件，启用离线模式');
        gradlePropertiesContent += '\n# 启用离线模式使用本地Gradle\norg.gradle.offline=true\n';
      } else {
        console.log('未检测到本地Gradle文件，将使用阿里云镜像进行在线下载');
      }
      
      await fs.writeFile(gradlePropertiesPath, gradlePropertiesContent);
      
      // 如果有本地Gradle文件，则更新gradle-wrapper.properties文件使用本地文件
      if (await fs.pathExists(this.gradleLibPath)) {
        const wrapperPropertiesPath = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');
        if (await fs.pathExists(wrapperPropertiesPath)) {
          // 备份原始文件
          await fs.copy(wrapperPropertiesPath, wrapperPropertiesPath + '.bak');
          
          // 创建新的配置指向本地Gradle，使用正确的file:// URI格式
          // 将Windows路径转换为file:// URI格式
          let gradleUri = 'file:///' + this.gradleLibPath.replace(/\\/g, '/');
          
          const wrapperPropertiesContent = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=${gradleUri}
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
          await fs.writeFile(wrapperPropertiesPath, wrapperPropertiesContent);
        }
      }
      
      console.log('Gradle配置完成');
    } catch (error) {
      console.warn('配置Gradle时出错:', error.message);
    }
  }

  async buildApk(projectDir, packageName) {
    try {
      const oldCwd = process.cwd();
      process.chdir(projectDir);
      
      try {
        // 同步web内容到Android项目
        console.log('正在同步web内容到Android项目...');
        try {
          execSync('npx cap copy', { stdio: 'inherit' });
        } catch (error) {
          throw new Error('同步web内容失败: ' + error.message);
        }
        
        // 检查Android环境
        console.log('正在检查Android环境...');
        try {
          execSync('npx cap doctor android', { stdio: 'inherit' });
        } catch (error) {
          console.warn('Android环境检查失败，可能会导致构建问题: ' + error.message);
        }
        
        // 使用Gradle构建APK
        const isWindows = process.platform === 'win32';
        const gradlewCommand = isWindows ? 'gradlew.bat' : './gradlew';
        
        // 检查gradlew文件是否存在
        const androidDir = path.join(projectDir, 'android');
        const gradlewPath = path.join(androidDir, gradlewCommand);
        if (!await fs.pathExists(gradlewPath)) {
          throw new Error('Gradle wrapper文件不存在: ' + gradlewPath);
        }
        
        // 进入android目录进行构建
        process.chdir(androidDir);
        
        // 检查Gradle环境
        console.log('正在检查Gradle环境...');
        let gradleInfo = null;
        try {
          gradleInfo = execSync('gradle --version', { stdio: 'pipe' });
          console.log('检测到系统Gradle:', gradleInfo.toString());
        } catch (error) {
          console.log('未检测到系统Gradle，将使用Gradle Wrapper');
        }
        
        console.log('开始构建APK...');
        try {
          // 首先尝试使用系统Gradle（如果存在）
          if (gradleInfo) {
            console.log('使用系统Gradle构建...');
            // 检查是否有本地Gradle文件来决定是否使用离线模式
            if (await fs.pathExists(this.gradleLibPath)) {
              execSync('gradle assembleDebug --offline', { stdio: 'inherit' });
            } else {
              execSync('gradle assembleDebug', { stdio: 'inherit' });
            }
          } else {
            // 使用Gradle Wrapper
            console.log('使用Gradle Wrapper构建...');
            // 检查是否有本地Gradle文件来决定是否使用离线模式
            if (await fs.pathExists(this.gradleLibPath)) {
              execSync(gradlewCommand + ' assembleDebug --offline', { stdio: 'inherit' });
            } else {
              execSync(gradlewCommand + ' assembleDebug', { stdio: 'inherit' });
            }
          }
        } catch (error) {
          console.error('构建过程中出现错误:', error.message);
          
          // 尝试使用不同的方法
          console.warn('标准构建方法失败，尝试使用替代方法...');
          
          // 尝试使用--no-daemon选项
          try {
            if (gradleInfo) {
              if (await fs.pathExists(this.gradleLibPath)) {
                execSync('gradle --no-daemon assembleDebug --offline', { stdio: 'inherit' });
              } else {
                execSync('gradle --no-daemon assembleDebug', { stdio: 'inherit' });
              }
            } else {
              if (await fs.pathExists(this.gradleLibPath)) {
                execSync(gradlewCommand + ' --no-daemon assembleDebug --offline', { stdio: 'inherit' });
              } else {
                execSync(gradlewCommand + ' --no-daemon assembleDebug', { stdio: 'inherit' });
              }
            }
          } catch (secondError) {
            // 最后的备选方案：检查是否可以使用已有的APK
            console.warn('所有在线构建方法都失败了，尝试检查是否已有构建好的APK...');
            const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
            if (await fs.pathExists(apkPath)) {
              console.log('检测到已存在的APK文件，直接使用该文件');
              // 复制APK到构建目录
              const outputApkPath = path.join(this.buildsDir, packageName + '-' + Date.now() + '.apk');
              await fs.copy(apkPath, outputApkPath);
              return outputApkPath;
            } else {
              throw new Error('APK构建失败: ' + error.message + 
                             '; 替代方法也失败: ' + secondError.message);
            }
          }
        }

        // 获取生成的APK文件
        const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
        if (!await fs.pathExists(apkPath)) {
          throw new Error('APK文件未生成，构建过程可能出错');
        }

        // 复制APK到构建目录
        const outputApkPath = path.join(this.buildsDir, packageName + '-' + Date.now() + '.apk');
        await fs.copy(apkPath, outputApkPath);

        return outputApkPath;
      } finally {
        // 恢复原来的工作目录
        process.chdir(oldCwd);
      }
    } catch (error) {
      throw new Error('APK构建失败: ' + error.message);
    }
  }

  async cleanUp(projectDir) {
    try {
      if (projectDir && await fs.pathExists(projectDir)) {
        await fs.remove(projectDir);
      }
    } catch (error) {
      console.warn('清理临时文件时出错:', error.message);
      // 不抛出错误，因为这不应该影响主要功能
    }
  }
}

// 处理APK生成的主函数
async function processWebToApk(config) {
  const builder = new ApkBuilder();
  let projectDir = null;

  try {
    // 处理应用图标
    await builder.processAppIcon(config.appIcon, config.packageName);

    // 准备网页内容
    await builder.prepareWebContent(config.webDirectory, config.packageName, config.mainPage);

    // 生成Android项目 (使用Capacitor)
    projectDir = await builder.generateAndroidProject(config);

    // 构建APK
    const apkPath = await builder.buildApk(projectDir, config.packageName);

    // 获取文件大小
    const stats = await fs.stat(apkPath);
    const fileSize = stats.size;

    // 生成下载URL（实际项目中可能需要更复杂的文件服务）
    const downloadUrl = '/downloads/' + path.basename(apkPath);

    return {
      downloadUrl,
      fileSize,
      apkPath
    };
  } catch (error) {
    throw error; // 重新抛出错误，让上层处理
  } finally {
    // 清理临时文件
    try {
      await builder.cleanUp(projectDir);
      
      // 清理上传的文件
      if (config.appIcon && config.appIcon.path) {
        await fs.remove(config.appIcon.path).catch(err => console.warn('清理应用图标文件时出错:', err));
      }
      if (config.webDirectory && config.webDirectory.length > 0) {
        // 清理所有上传的文件
        for (const file of config.webDirectory) {
          await fs.remove(file.path).catch(err => console.warn('清理网页目录文件时出错:', err));
        }
      }
    } catch (cleanupError) {
      console.warn('清理过程中出现错误:', cleanupError.message);
    }
  }
}

module.exports = {
  ApkBuilder,
  processWebToApk
};