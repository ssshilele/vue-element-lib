<template>
  <el-table class="custom-table" ref="local-table" :data="data_view" v-on="customListeners"
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
  export default {
    props: {
      data: Array,
      configs: { type: Array, required: true },
      pageIndex: {
        type: Number,
        validator (value) { return Number.isInteger(value) && value > -1 }
      }, // 如需分页，则 pageIndex 必需，表示当前页数
      pageSize: {
        type: Number,
        validator (value) { return Number.isInteger(value) && value > 0 },
        default: 20
      }, // 如需分页，可以定义 pageSize（默认 20），表示每页数据条数

      labelHidden: { type: Boolean, default: false },
      border: { type: Boolean, default: true },
      stripe: { type: Boolean, default: true },
      highlightCurrentRow: { type: Boolean, default: true },
      rowClassName: Function,
      height: [Number, String],
      maxHeight: [Number, String],
      defaultSort: Object,
      rowKey: [String, Function],

      waitTime: { type: Number, default: 300 }
    },
    data () {
      return {
        data_view: [],

        /* 1. table_configs 的初始值若不从 props 中的 configs 获取，则需要在 table_configs 的 watcher 中
              声明立即监听（immediate: true）；
           2. 这里原则上应该采用深拷贝+双向绑定形式，因为组件内、外部都可能会改变该值，而 Vue 是不推荐在子组件中直接改变父组件通过 props
              传入的值的。但是采用直接引用赋值的方式操作更加简单，因为同样地，table_configs 和 configs 也是指向同一个对象，
              所以在任意一端改变其内部的某个属性值都能在两端同时体现。（注意，若是基本类型，则只能进行双向数据绑定）
         */
        table_configs: this.configs,

        timeoutId: null,

        currentOrder: '',
        currentDirection: '',

        // 翻页时，保存之前页的行选中情况
        selections: [],
        selectionTimeoutId: null
      }
    },
    watch: {
      pageSize () {
        this.setData()
      },
      pageIndex () {
        this.setData()
      },
      data () {
        this.setData()
      },
      table_configs: {
        // configs 的引用在组件外部基本不会改变，所以无需进行数据同步。也就是说，这里监听 table_configs 或 configs 的变化均可
        handler () {
          clearTimeout(this.timeoutId);
          this.timeoutId = setTimeout(this.setData, this.waitTime) // 延时，防止输入抖动
        },
        immediate: true, // 若数据是本地写死的，则有必要在创建时就 setData
        deep: true // 只有深度监听其内部的变化，才能获得用户输入的搜索关键词
      }
    },
    computed: {
      customListeners () {
        const _this = this;
        return {
          ...this.$listeners,
          'selection-change': _this.selectionChangeHandler,
          'sort-change' (sortData) {
            _this.sortChanged(sortData);
            _this.$emit('sort-change', sortData)
          }
        }
      }
    },
    methods: {
      selectionChangeHandler (selection) {
        // toggleRowSelection 方法每次都会触发一次 selection-change 事件
        clearTimeout(this.selectionTimeoutId);
        this.selectionTimeoutId = setTimeout(() => {
          this.setSelections(selection);
          this.$emit('selection-change', this.selections.concat())
        }, this.waitTime)
      },

      setData () {
        if (typeof this.pageIndex === 'number') {
          // pageIndex 存在则表示需要分页
          this.data_view = this.pageData()
        } else {
          // pageIndex 不存在表示无需分页，只需过滤、排序
          this.data_view = this.sortData();
        }
        // 当页面存在跨分页多选时，需要标记之前选中的行
        this.$nextTick(() => {
          this.data_view.forEach(row => {
            const tag = this.selections.some(item => item[this.rowKey] === row[this.rowKey]);
            this.$refs['local-table'].toggleRowSelection(row, tag)
          })
        })
      },
      // 用户点击切换行/页的选中按钮，更新选择结果到 this.selections 中
      setSelections (selection) {
        this.pageData()
          .forEach(row => {
            if (selection.some(item => item[this.rowKey] === row[this.rowKey])) {
              if (!this.selections.some(item => item[this.rowKey] === row[this.rowKey])) {
                // 当前已选中 且 已选中列表中没有
                this.selections.push(row)
              }
            } else {
              // 没有选中，去已选中列表中删除
              let index = 0, len = this.selections.length;
              while (index < len && this.selections[index][this.rowKey] !== row[this.rowKey]) index++;
              if (index < len) {
                this.selections.splice(index, 1)
              }
            }
          })
      },
      pageData () {
        const start = (this.pageIndex - 1) * this.pageSize;
        let end = this.pageIndex * this.pageSize;
        const searchData = this.sortData();
        if (end > searchData.length) end = searchData.length;
        const pageData = searchData.slice(start, end);
        this.$emit('paged', pageData);
        return pageData
      },
      sortData () {
        const data = this.filterData();
        if (this.currentOrder && this.currentDirection) {
          const direction = this.currentDirection === 'descending' ? -1 : 1;
          data.sort((a, b) => {
            const order = a[this.currentOrder] < b[this.currentOrder] ? -1 : 1;
            return order * direction
          })
        }
        this.$emit('searched', data); // data 是过滤、排序后未分页的全部数据
        return data
      },
      filterData () {
        if (!this.data) return [];
        const params = this.filterParams();
        return this.data.filter(item => {
          return Object.keys(params).every(_item => {
            return (
              (
                !params[_item].strict &&
                typeof item[_item] === 'string' && typeof params[_item].value === 'string' &&
                item[_item].toLowerCase().includes(params[_item].value.toLowerCase())
              ) ||
              item[_item] === params[_item].value
            )
          })
        })
      },
      filterParams () {
        const params = {};
        this.table_configs.forEach(config => {
          /* 过滤项的值可以是字符串、数值、布尔值。
             字符串默认模糊匹配，但若指定了 strict 则严格匹配；
             数值需要指定 isNumber，否则会被视为字符串进行比较；
             布尔值需要指定 isBoolean，否则会被视为字符串进行比较。
          */
          if (config.key &&
            (config.value || config.value === 0 || typeof config.value === 'boolean')
          ) {
            params[config.key] = {
              value: config.isNumber ? Number(config.value)
                : typeof config.value === 'string' ? config.value.trim() : config.value,
              strict: config.strict
            }
          }
        });
        return params
      },

      // eslint-disable-next-line no-unused-vars
      sortChanged ({ column, prop, order }) {
        this.currentOrder = prop;
        this.currentDirection = order;
        this.setData()
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
      },

      // el-table 自带的全选按钮，在分页的情况下只能全选本页，而不是所有页
      // 这里提供一键全选/取消所有页数据的方法
      toggleAllSelection () {
        const tag = this.selections.length === this.data.length;
        this.selections = tag ? [] : this.data.concat();
        this.$nextTick(() => {
          Array.isArray(this.data) && this.data.forEach(row => {
            this.$refs['local-table'].toggleRowSelection(row, !tag)
          })
        })
      }
    }
  }
</script>

<style scoped>
</style>
