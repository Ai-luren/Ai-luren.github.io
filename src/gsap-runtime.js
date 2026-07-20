// 原生 index.html 先加载 GSAP；React 组件统一复用同一个全局实例。
export function getGsap() {
  return typeof window !== 'undefined' && window.gsap ? window.gsap : null;
}
