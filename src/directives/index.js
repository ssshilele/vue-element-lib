import Vue from 'vue'

// 注册一个无限滚动加载的全局自定义指令
Vue.directive('scroll-load', {
  bind (el, binding) {
    const bindElement = el.querySelector(binding.value.selector);
    let distance = binding.value.distance || 0; // distance 是触发加载的距离阈值
    const biDirection = !!binding.value.biDirection; // 是否允许双向滚动，默认只允许向下滚动
    let lastPosition = 0;
    bindElement.addEventListener('scroll', () => {
      // 事件处理函数中，bindElement = this（箭头函数除外） = event.currentTarget
      // 事件真正触发的元素是 event.target， event.currentTarget 可能是 event.target 的父级元素
      const direction = bindElement.scrollTop - lastPosition > 0; // 滚动方向，向下滚动为 true
      lastPosition = bindElement.scrollTop; // 记录当前滚动位置
      // 向下滚动，并且距离底部只有 distance 长度
      if (direction && (bindElement.scrollHeight - (bindElement.clientHeight + bindElement.scrollTop) <= distance)) {
        binding.value.method(direction, bindElement)
      }
      // 向上滚动，并且距离顶部只有 distance 长度
      if (biDirection && !direction && (bindElement.scrollTop <= distance)) {
        binding.value.method(direction, bindElement)
      }
    })
  }
});
