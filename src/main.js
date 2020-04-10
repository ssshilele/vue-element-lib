import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import Element from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

import './directives'
import './style/index.less'

import SvgIcon from './components/SvgIcon'
import FilterSelect from './components/FilterSelect'
import LocalTable from './components/LocalTable'
import RemoteTable from './components/RemoteTable'

Vue.config.productionTip = false;
Vue.use(Element, { size: 'small' });

Vue.component('svg-icon', SvgIcon);
Vue.component('filter-select', FilterSelect);
Vue.component('local-table', LocalTable);
Vue.component('remote-table', RemoteTable);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app');
