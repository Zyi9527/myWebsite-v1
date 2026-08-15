// galleryConfig.js – 画廊分类配置
export const galleryCategories = {
  '3D-design': {
    label: '3D Design',
    icon: '3d',               // 用于选择图标样式
    count: 6                  // ← 修改成你实际图片数量
  },
  'Graphic-design': {
    label: 'Graphic Design',
    icon: 'graphic',
    count: 8
  },
  'KV-design': {
    label: 'KV Design',
    icon: 'kv',
    count: 5
  },
  'VM-design': {
    label: 'VM Design',
    icon: 'vm',
    count: 7
  }
  // 未来新增分类只需在这里加一个对象
};

// 基础路径
export const THUMB_PATH = 'images/gallery-thumbnails';   // 缩略图目录
export const FULL_PATH = 'images/gallery-fullscreen';    // 全屏图目录