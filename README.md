# 音乐星际

通过移动、缩放和点选，在星空中发现歌手和歌曲的浏览器应用原型。

当前版本支持不规则云团、按区域歌手数量和局部密度呈现的浓淡/亮暗、靠近自动展开歌曲，以及本地合成音频试听。所有歌手、歌曲和指标均为演示数据。

## 查看与运行

直接用 Edge 或 Chrome 打开 [`music-galaxy-app/preview.html`](music-galaxy-app/preview.html)，无需安装依赖。

也可启动本地服务：

```sh
cd music-galaxy-app
npm run dev
```

打开 http://127.0.0.1:5173 。拖动移动、滚轮缩放、Shift + 拖动旋转；靠近歌手后歌曲自然展开，点星球查看播放。

## 源码检查

```sh
cd music-galaxy-app
npm run check
npm test
npm run build:preview
```

最后一个命令根据源码更新单文件预览。

## 项目文档

- [产品设计与开发文档](音乐星际-产品设计与开发文档.md)
- [开发记录与验证结果](开发记录.md)
- [原型详细说明](music-galaxy-app/README.md)
- [来源说明](music-galaxy-app/THIRD_PARTY_NOTICES.md)

当前为 Canvas 三维投影的交互验证版，正式 React/TypeScript/Three.js 工程、真实音乐授权和服务端统计尚待实施。
