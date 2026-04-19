# IP 角色图片资源

## 需要的文件

把你的两张 PNG 保存到这里,**文件名必须严格一致**:

- `lulu.png` — 露露 (戴眼镜的少女,知性向导角色)
- `tuanxiaoman.png` — 团小满 (粉绿小萌宠,常驻右下角陪伴)

## 建议规格

- 格式: PNG 带透明背景(去背景的抠图最佳)
- 尺寸: 短边 >= 400px,长宽比随意
- 体积: 建议 < 300 KB(PNG 可用 tinypng 压一下)

## 放好之后

Git commit 推送到 GitHub → Vercel 自动部署 → 角色自动出现。
如果用 `git status` 看不到 assets 里的文件,检查:
- 文件名拼写(必须是 `lulu.png` 和 `tuanxiaoman.png`,全小写)
- `.gitignore` 没有误排除它们

## 不放图会怎样?

系统会优雅地隐藏两个角色位置,其他功能一切正常。

