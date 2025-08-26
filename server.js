const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { processWebToApk } = require('./apk-builder');
const fileRoutes = require('./file-routes');

const app = express();
const port = process.env.PORT || 3000;

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 使用文件路由
app.use('/', fileRoutes);

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保留原始文件扩展名
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  }
});

// API路由
app.post('/api/generate-apk', upload.fields([
  { name: 'appIcon', maxCount: 1 },
  { name: 'webDirectory', maxCount: 100 } // 允许上传多个文件
]), async (req, res) => {
  try {
    const { 
      appName, 
      packageName, 
      appVersion,
      versionCode,
      mainPage 
    } = req.body;

    console.log('收到APK生成请求:', { appName, packageName, appVersion, versionCode, mainPage });

    // 验证必需参数
    if (!appName || !packageName) {
      console.warn('缺少必需参数:', { appName: !!appName, packageName: !!packageName });
      return res.status(400).json({
        success: false,
        message: '应用名称和包名是必填项'
      });
    }

    // 处理APK生成
    const result = await processWebToApk({
      appName,
      packageName,
      appVersion: appVersion || '1.0.0',
      versionCode: versionCode || '1',
      mainPage: mainPage || 'index.html',
      appIcon: req.files.appIcon ? req.files.appIcon[0] : null,
      webDirectory: req.files.webDirectory ? req.files.webDirectory : null
    });

    console.log('APK生成成功:', result.downloadUrl);

    // 返回成功响应
    res.json({
      success: true,
      message: 'APK生成成功',
      downloadUrl: result.downloadUrl,
      fileSize: result.fileSize
    });
  } catch (error) {
    console.error('APK生成错误:', error);
    res.status(500).json({
      success: false,
      message: `APK生成失败: ${error.message}`
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
  // 确保必要目录存在
  fs.ensureDirSync(path.join(__dirname, 'assets'));
  fs.ensureDirSync(path.join(__dirname, 'builds'));
  fs.ensureDirSync(path.join(__dirname, 'temp'));
  fs.ensureDirSync(path.join(__dirname, 'uploads'));
});