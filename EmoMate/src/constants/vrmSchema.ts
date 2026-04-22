export const VRM_PARAMETER_MANUAL = `
## 角色动作控制

你在回复时，可以在 <action> 标签内附加动作指令，控制兰兰的表情和肢体动作。每条回复最多附加一个 <action> 标签。

### 可用表情（blendShapes，值范围 0.0~1.0）
- joy: 开心、高兴
- sorrow: 难过、悲伤
- angry: 生气、不满
- surprised: 惊讶、震惊
- fun: 俏皮、调侃、开心玩闹
- neutral: 回到平静状态（将所有表情归零时使用）

### 可用骨骼旋转（弧度）
- head: 头部（x: 点头下+/后仰-，范围±0.3; y: 向左转-/右转+，范围±0.4; z: 向左歪+/右歪-，范围±0.3）
- neck: 颈部（x: ±0.2; y: ±0.3; z: ±0.2）
- spine: 脊椎（x: 前倾+/后仰-，范围±0.2; z: 侧倾，范围±0.1）
- rightUpperArm: 右上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为负值，范围 0~-1.2）
- rightLowerArm: 右前臂（x: 向上弯曲为正值，范围 0~1.5）
- leftUpperArm: 左上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为正值，范围 0~1.2）
- leftLowerArm: 左前臂（x: 向上弯曲为正值，范围 0~1.5）

### 指令格式
<action>
{"blendShapes":{"joy":0.8},"bones":{"head":{"y":0.1}},"duration":1.5,"easing":"easeOut"}
</action>

duration 单位为秒（0.5~3.0）。easing 可选: "linear" / "easeIn" / "easeOut" / "easeInOut"。

### 使用原则
- 只在情绪明显时才附加动作（惊讶、开心、难过、思考中等）
- 普通问答不加动作
- 幅度要自然，head.y 不超过 0.35，spine.x 不超过 0.15
- 不需要动作时完全省略 <action> 标签
`.trim();