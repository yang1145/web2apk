const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// 提供APK下载
router.get('/downloads/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'builds', filename);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).send('文件未找到');
    }

    res.download(filePath, err => {
      if (err) {
        console.error('下载错误:', err);
        res.status(500).send('下载失败');
      }
    });
  } catch (error) {
    console.error('文件服务错误:', error);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;