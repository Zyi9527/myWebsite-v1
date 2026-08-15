import os
from PIL import Image

# ---------- 不用改的部分 ----------
FRAMES_DIR = r"D:\工作文件\2026整理\作品集\归档\徽章\动画\Main"            # 你的原始图片在这里
OUT_DIR = r"D:\工作文件\myWebsite\images\frames_optimized"     # 处理完的图片会放在这里
TARGET_WIDTH = 1920                     # 缩放到1920像素宽（清晰又不太大）
WEBP_QUALITY = 85                       # 质量85%，透明背景完美保留
# -----------------------------------

def main():
    # 创建输出文件夹
    os.makedirs(OUT_DIR, exist_ok=True)

    # 按文件名字母顺序读取所有图片
    files = sorted(os.listdir(FRAMES_DIR))
    img_exts = ('.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp')
    img_files = [f for f in files if f.lower().endswith(img_exts)]

    print(f"找到 {len(img_files)} 张图片，开始处理...")

    for idx, fname in enumerate(img_files):
        src_path = os.path.join(FRAMES_DIR, fname)
        # 新名字：frame_000.webp, frame_001.webp ... frame_060.webp
        new_name = f"frame_{idx:03d}.webp"
        dst_path = os.path.join(OUT_DIR, new_name)

        try:
            with Image.open(src_path) as img:
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')   # 确保透明通道保留
                # 计算缩放后的高
                w, h = img.size
                new_h = int(h * (TARGET_WIDTH / w))
                img_resized = img.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
                img_resized.save(dst_path, 'webp', quality=WEBP_QUALITY, lossless=False)
            print(f"  ✅ {fname} → {new_name}")
        except Exception as e:
            print(f"  ❌ 处理 {fname} 时出错：{e}")

    print("\n✨ 完成！请查看 images/frames_optimized 文件夹。")

if __name__ == "__main__":
    try:
        from PIL import Image
    except ImportError:
        print("❌ 需要安装 Pillow 库，请在底部的 Terminal 里输入：pip install Pillow")
        print("   安装完后重新运行本脚本（右键文件名→运行）")
        exit(1)
    main()

