# 网页转APK工具

这是一个可以将网页转换为Android APK文件的工具，包含Web版本和Windows桌面版本。

## 功能特性

- 将网页项目打包成Android APK文件
- 支持自定义应用名称、包名、版本号等信息
- 支持上传自定义应用图标
- 支持上传整个网页项目目录

## 项目结构

```
web2apk/
├── public/                 # 前端静态文件
│   ├── index.html          # Web版主页面
│   └── desktop.html        # 桌面版主页面
├── Web2Apk.Desktop/        # WebView2桌面应用程序
│   ├── Web2Apk.Desktop.csproj
│   ├── global.json
│   └── Program.cs
├── apk-builder.js          # APK构建核心逻辑
├── file-routes.js          # 文件路由处理
├── server.js               # Node.js服务器
└── package.json            # 项目依赖配置
```

## 环境要求

### Web版本
- Node.js v18或更高版本
- Android SDK (用于APK构建)
- Gradle构建工具

### 桌面版本
- Windows 10或更高版本
- .NET 8.0 SDK
- Visual Studio 2022 或更高版本
- Node.js v18或更高版本 (用于内嵌服务器)

## 安装和运行

### Web版本

1. 安装依赖:
   ```
   npm install
   ```

2. 启动服务器:
   ```
   npm start
   ```

3. 在浏览器中访问 `http://localhost:3000`

### 桌面版本

1. 确保已安装 .NET 8.0 SDK

2. 使用 Visual Studio 打开 `Web2Apk.Desktop/Web2Apk.Desktop.csproj`

3. 构建并运行项目

或者使用命令行:
```
cd Web2Apk.Desktop
dotnet build
dotnet run
```

## 使用说明

1. 填写应用基本信息:
   - 应用名称
   - 包名 (必须是唯一的，遵循Java包命名规范)
   - 版本号
   - 版本代码

2. 上传应用图标 (可选):
   - 支持PNG、JPG、JPEG格式
   - 建议尺寸512x512像素

3. 选择网页目录:
   - 选择包含网页项目的整个文件夹
   - 确保项目有一个主页面文件(如index.html)

4. 选择主页面文件:
   - 从下拉菜单中选择主页面文件名

5. 点击"生成APK文件"按钮开始构建

6. 构建完成后会自动下载生成的APK文件

## 技术说明

### 后端技术栈
- Node.js
- Express.js
- Multer (文件上传)
- Sharp (图片处理)
- adm-zip (ZIP文件处理)
- fs-extra (文件系统扩展)

### 前端技术栈
- 原生HTML/CSS/JavaScript
- Font Awesome图标库

### 桌面版技术栈
- .NET 8.0
- WebView2
- Windows Forms

### APK构建过程
1. 处理应用图标并生成多种尺寸
2. 准备网页内容
3. 生成Android项目结构
4. 使用Gradle构建APK
5. 提供下载链接

## 注意事项

1. 首次运行需要确保Android开发环境已正确配置
2. APK构建过程可能需要一些时间，请耐心等待
3. 生成的APK文件保存在 `builds` 目录中
4. 上传的文件临时保存在 `uploads` 目录中，处理完成后会自动清理

## 故障排除

### 服务器无法启动
- 确保已安装Node.js
- 检查端口3000是否被占用

### APK构建失败
- 确保Android SDK已正确安装
- 检查环境变量是否配置正确
- 确保有足够的磁盘空间

### 桌面版无法运行
- 确保已安装.NET 8.0 SDK
- 确保Node.js在系统PATH中可用