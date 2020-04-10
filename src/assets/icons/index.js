
// 创建一个 context，加载来自 ./svg 目录，以 `.svg` 结尾的文件

const context = require.context('./svg', false, /\.svg$/);

context.keys().map(context);

// const requireAll = requireContext => requireContext.keys().map(requireContext)
// requireAll(context)
