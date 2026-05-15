/**
 * ThemeEngine — 幻灯片主题系统
 * 每套主题包含：配色 + 字体 + 布局参数
 * 可在此文件中添加新主题，无需修改渲染逻辑
 */

const ThemeEngine = {
  // ── 内置主题库 ──────────────────────────────
  themes: {

    /**
     * 深蓝专业  ── 商务 / 汇报
     */
    corporate: {
      id: 'corporate',
      name: '深蓝专业',
      preview: ['#0A2342', '#FFFFFF', '#2196F3'],
      cover: {
        bg: '0A2342',
        titleColor: 'FFFFFF',
        subtitleColor: '90CAF9',
        accentColor: '2196F3',
        accentW: 1.4, accentH: 0.06,
        accentX: 0.5, accentY: 3.1
      },
      content: {
        bg: 'F5F9FF',
        headerBg: '0A2342',
        titleColor: 'FFFFFF',
        bodyBg: 'FFFFFF',
        pointColor: '1A3558',
        bulletColor: '2196F3',
        bulletShape: 'rect',   // rect | circle | line
        borderColor: 'DCE8F7'
      },
      agenda: {
        bg: 'EBF3FF',
        headerBg: '0A2342',
        titleColor: 'FFFFFF',
        itemBg: 'FFFFFF',
        itemBorder: '2196F3',
        itemText: '1A3558',
        numColor: '2196F3'
      },
      end: {
        bg: '0A2342',
        titleColor: 'FFFFFF',
        subtitleColor: '90CAF9'
      },
      font: {
        title: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        titleSize: 36,
        subtitleSize: 18,
        headingSize: 24,
        pointSize: 15
      }
    },

    /**
     * 暗夜极简  ── 科技 / 产品发布
     */
    dark: {
      id: 'dark',
      name: '暗夜极简',
      preview: ['#0D0D0D', '#FFFFFF', '#00E5FF'],
      cover: {
        bg: '0D0D0D',
        titleColor: 'FFFFFF',
        subtitleColor: '888888',
        accentColor: '00E5FF',
        accentW: 2.0, accentH: 0.04,
        accentX: 0.5, accentY: 3.0
      },
      content: {
        bg: '111111',
        headerBg: '1A1A1A',
        titleColor: 'FFFFFF',
        bodyBg: '1A1A1A',
        pointColor: 'CCCCCC',
        bulletColor: '00E5FF',
        bulletShape: 'line',
        borderColor: '333333'
      },
      agenda: {
        bg: '0D0D0D',
        headerBg: '1A1A1A',
        titleColor: 'FFFFFF',
        itemBg: '1A1A1A',
        itemBorder: '00E5FF',
        itemText: 'CCCCCC',
        numColor: '00E5FF'
      },
      end: {
        bg: '0D0D0D',
        titleColor: 'FFFFFF',
        subtitleColor: '666666'
      },
      font: {
        title: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        titleSize: 38,
        subtitleSize: 17,
        headingSize: 22,
        pointSize: 14
      }
    },

    /**
     * 清新绿意  ── 教育 / 环保 / 健康
     */
    fresh: {
      id: 'fresh',
      name: '清新绿意',
      preview: ['#1B5E20', '#FFFFFF', '#69F0AE'],
      cover: {
        bg: '1B5E20',
        titleColor: 'FFFFFF',
        subtitleColor: 'A5D6A7',
        accentColor: '69F0AE',
        accentW: 1.2, accentH: 0.06,
        accentX: 0.5, accentY: 3.15
      },
      content: {
        bg: 'F1F8F1',
        headerBg: '2E7D32',
        titleColor: 'FFFFFF',
        bodyBg: 'FFFFFF',
        pointColor: '1B4A1E',
        bulletColor: '43A047',
        bulletShape: 'circle',
        borderColor: 'C8E6C9'
      },
      agenda: {
        bg: 'E8F5E9',
        headerBg: '2E7D32',
        titleColor: 'FFFFFF',
        itemBg: 'FFFFFF',
        itemBorder: '43A047',
        itemText: '1B4A1E',
        numColor: '43A047'
      },
      end: {
        bg: '1B5E20',
        titleColor: 'FFFFFF',
        subtitleColor: 'A5D6A7'
      },
      font: {
        title: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        titleSize: 36,
        subtitleSize: 18,
        headingSize: 23,
        pointSize: 15
      }
    },

    /**
     * 暖橙活力  ── 路演 / 创业 / 活动
     */
    warm: {
      id: 'warm',
      name: '暖橙活力',
      preview: ['#BF360C', '#FFFFFF', '#FF6D00'],
      cover: {
        bg: 'BF360C',
        titleColor: 'FFFFFF',
        subtitleColor: 'FFCCBC',
        accentColor: 'FF6D00',
        accentW: 1.6, accentH: 0.07,
        accentX: 0.5, accentY: 3.1
      },
      content: {
        bg: 'FFF8F5',
        headerBg: 'BF360C',
        titleColor: 'FFFFFF',
        bodyBg: 'FFFFFF',
        pointColor: '5D1A0A',
        bulletColor: 'F4511E',
        bulletShape: 'rect',
        borderColor: 'FFCCBC'
      },
      agenda: {
        bg: 'FBE9E7',
        headerBg: 'BF360C',
        titleColor: 'FFFFFF',
        itemBg: 'FFFFFF',
        itemBorder: 'F4511E',
        itemText: '5D1A0A',
        numColor: 'F4511E'
      },
      end: {
        bg: 'BF360C',
        titleColor: 'FFFFFF',
        subtitleColor: 'FFCCBC'
      },
      font: {
        title: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        titleSize: 37,
        subtitleSize: 18,
        headingSize: 24,
        pointSize: 15
      }
    },

    /**
     * 莫兰迪灰  ── 高端 / 时尚 / 品牌
     */
    morandi: {
      id: 'morandi',
      name: '莫兰迪',
      preview: ['#5C6B7A', '#F7F4F0', '#B0956F'],
      cover: {
        bg: '5C6B7A',
        titleColor: 'F7F4F0',
        subtitleColor: 'C5CAD0',
        accentColor: 'B0956F',
        accentW: 1.8, accentH: 0.05,
        accentX: 0.5, accentY: 3.2
      },
      content: {
        bg: 'F7F4F0',
        headerBg: '5C6B7A',
        titleColor: 'F7F4F0',
        bodyBg: 'FFFFFF',
        pointColor: '3A454F',
        bulletColor: 'B0956F',
        bulletShape: 'line',
        borderColor: 'DDD9D3'
      },
      agenda: {
        bg: 'F0EDE8',
        headerBg: '5C6B7A',
        titleColor: 'F7F4F0',
        itemBg: 'FFFFFF',
        itemBorder: 'B0956F',
        itemText: '3A454F',
        numColor: 'B0956F'
      },
      end: {
        bg: '5C6B7A',
        titleColor: 'F7F4F0',
        subtitleColor: 'C5CAD0'
      },
      font: {
        title: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        titleSize: 36,
        subtitleSize: 17,
        headingSize: 22,
        pointSize: 15
      }
    }
  },

  // ── 获取主题 ─────────────────────────────────
  get(id) {
    return this.themes[id] || this.themes.corporate;
  },

  // ── 注册自定义主题（对外扩展入口）────────────
  register(id, themeConfig) {
    if (!themeConfig.cover || !themeConfig.content || !themeConfig.font) {
      throw new Error('Theme must include cover, content, and font sections.');
    }
    this.themes[id] = { id, ...themeConfig };
  },

  list() {
    return Object.values(this.themes).map(t => ({ id: t.id, name: t.name, preview: t.preview }));
  }
};

if (typeof module !== 'undefined') module.exports = { ThemeEngine };
if (typeof window !== 'undefined') window.ThemeEngine = ThemeEngine;
