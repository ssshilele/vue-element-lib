<template>
  <el-table class="custom-table" :data="data" v-on="customListeners"
            :border="border" :stripe="stripe" :highlight-current-row="highlightCurrentRow"
            :max-height="maxHeight" :height="height" :row-class-name="rowClassName"
            :default-sort="defaultSort" :row-key="rowKey">
    <template v-for="config in table_configs">
      <!--sortable 需要为 custom 才能自定义排序-->
      <el-table-column :key="config.prop" :prop="config.prop" :label="config.label" :type="config.type"
                       :selectable="config.selectable"
                       :sortable="config.sortable ? 'custom' : false" :sort-orders="config.sortOrders"
                       :min-width="config.minWidth" :width="config.width" :fixed="config.fixed" :align="config.align">
        <template #header="{ column, $index }">
          <span v-if="config.filterHeader && !config.labelHidden && !labelHidden">{{ config.label }}&nbsp;&nbsp;</span>
          <slot :name="'header_' + config.prop" :column="column" :$index="$index">
            <span v-if="config.filterHeader" @click.stop>
              <el-select v-if="config.options" class="table-header-input" v-model="config.value" clearable
                         size="mini" :filterable="config.filterable" :style="getInputWidth(config)"
                         :placeholder="(config.labelHidden || labelHidden) ? config.label : '请选择搜索项'">
                <el-option v-for="option in config.options" :key="getOption(config, option, 'value')"
                           :value="getOption(config, option, 'value')" :label="getOption(config, option, 'label')">
                </el-option>
              </el-select>
              <el-input v-else class="table-header-input" v-model="config.value" size="mini"
                        :style="getInputWidth(config)"
                        :placeholder="(config.labelHidden || labelHidden) ? config.label : '输入关键字搜索'"/>
            </span>
            <span v-else>{{ config.label }}</span>
          </slot>
        </template>
        <template v-if="!config.type" v-slot="{ row, column, $index }">
          <slot :name="config.prop" :row="row" :column="column" :$index="$index">{{ row[config.prop] }}</slot>
        </template>
      </el-table-column>
    </template>
  </el-table>
</template>

<script>
  // RemoteTable 无需提供像 LocalTable 那样的多页全选功能，因为 RemoteTable 始终只保存了当前一页的数据
  export default {
    props: {
      // 表格展示的数据，也就是外部请求每次加载的数据，本组件内不会对其进行修改
      data: Array,
      // 如何展示数据的配置项，同时也是缓存搜索条件的地方
      configs: { type: Array, required: true },
      // 必需，表示当前页码
      pageIndex: {
        type: Number,
        validator (value) { return Number.isInteger(value) && value > -1 },
        required: true
      },
      // 表示每页数据条数，默认 20
      pageSize: {
        type: Number,
        validator (value) { return Number.isInteger(value) && value > 0 },
        default: 20
      },

      labelHidden: { type: Boolean, default: false },
      border: { type: Boolean, default: true },
      stripe: { type: Boolean, default: true },
      highlightCurrentRow: { type: Boolean, default: true },
      rowClassName: Function,
      height: [Number, String],
      maxHeight: [Number, String],
      defaultSort: Object,
      rowKey: [String, Function]
    },
    data () {
      return {
        /* 1. table_configs 的初始值若不从 props 中的 configs 获取，则需要在 table_configs 的 watcher 中
                声明立即监听（immediate: true）；
             2. 这里原则上应该采用深拷贝+双向绑定形式，因为组件内、外部都可能会改变该值，而 Vue 是不推荐在子组件中直接改变父组件通过 props
                传入的值的。但是采用直接引用赋值的方式操作更加简单，因为同样地，table_configs 和 configs 也是指向同一个对象，
                所以在任意一端改变其内部的某个属性值都能在两端同时体现。（注意，若是基本类型，则只能进行双向数据绑定）
           */
        table_configs: this.configs,

        timeoutId: null,

        currentOrder: '',
        currentDirection: ''
      }
    },
    created () {
      // 初始化时设定参数。但若 defaultSort 存在，则不必设定，因为 defaultSort 会触发 sort-change 事件
      if (!this.defaultSort) this.setParams()
    },
    computed: {
      customListeners () {
        const _this = this;
        return {
          ...this.$listeners,
          'sort-change' (sortData) {
            _this.sortChanged(sortData);
            _this.$emit('sort-change', sortData)
          }
        }
      }
    },
    watch: {
      pageSize () {
        this.setParams()
      },
      pageIndex () {
        this.setParams()
      },
      table_configs: {
        // configs 的引用在组件外部基本不会改变，所以无需进行数据同步。也就是说，这里监听 table_configs 或 configs 的变化均可
        handler () {
          clearTimeout(this.timeoutId);
          this.timeoutId = setTimeout(this.setParams, this.waitTime) // 延时，防止输入抖动
        },
        deep: true // 只有深度监听其内部的变化，才能获得用户输入的搜索关键词
      }
    },
    methods: {
      setParams () {
        this.$emit('filter', this.getParams())
      },
      getParams () {
        const params = {
          pageSize: this.pageSize,
          pageIndex: this.pageIndex,
          order: this.currentOrder,
          direction: this.currentDirection
        };
        this.table_configs.forEach(item => {
          if (item.key) params[item.key] = typeof item.value === 'string' ? item.value.trim() : item.value
        });
        return params
      },
      sortChanged ({ column, prop, order }) {
        this.currentOrder = prop;
        this.currentDirection = order;
        this.setParams()
      },

      // 选择框绑定的值只能是 string、number、boolean 三种类型其一，否则无法用于搜索过滤
      getOption (column, option, type) {
        if (type === 'value') {
          // 若指定了 valueKey，则选项值为 option[valueKey]
          // 否则，若 option.value 存在，则默认使用 option.value
          // 否则，认为 option 是基本类型，使用 option 本身
          return column.valueKey ? option[column.valueKey]
            : ['string', 'number', 'boolean'].includes(typeof option.value) ? option.value : option
        } else if (type === 'label') {
          // 若指定了 labelKey，则选项值为 option[labelKey]
          // 否则，若 option.label 存在，则默认使用 option.label
          // 否则，判断 option[valueKey] 或 option.value 是否存在，若存在则使用它们
          // 最后，认为 option 是基本类型，使用 option 本身
          return column.labelKey ? String(option[column.labelKey])
            : ['string', 'number', 'boolean'].includes(typeof option.label) ? String(option.label)
              : column.valueKey ? String(option[column.valueKey])
                : ['string', 'number', 'boolean'].includes(typeof option.value) ? String(option.value)
                  : String(option)
        } else return option
      },
      getInputWidth (config) {
        const widths = {
          width: config.sortable ? 'calc(100% - 24px)' : '100%',
          minWidth: 0,
          maxWidth: '125px'
        };
        const keys = ['inputWidth', 'minInputWidth', 'maxInputWidth'];
        keys.forEach(key => {
          const value = typeof config[key] === 'number' && config[key] >= 0
            ? config[key] + 'px' : typeof config[key] === 'string' ? config[key] : null;
          if (value) {
            const k = key.replace(/inputWidth/ig, '') + 'width';
            widths[k] = value
          }
        });
        return widths
      }
    }
  }
</script>

<style scoped>
</style>
