-- SlideForge 版式库数据库
-- 在 Cloudflare D1 控制台或用 wrangler d1 execute 执行一次

-- 版式主表
CREATE TABLE IF NOT EXISTS layouts (
  id          TEXT PRIMARY KEY,          -- 版式唯一标识，如 content_cards
  name        TEXT NOT NULL,             -- 中文名称
  slide_type  TEXT NOT NULL,             -- cover | end | agenda | section | content
  tags        TEXT NOT NULL DEFAULT '[]',-- JSON 数组字符串，如 '["并列","卡片"]'
  point_min   INTEGER,                   -- 适合的最少要点数
  point_max   INTEGER,                   -- 适合的最多要点数
  regions     TEXT NOT NULL,             -- 完整 regions JSON 数组字符串
  slots       TEXT NOT NULL DEFAULT '[]',-- 用到的数据字段
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 版式索引（按类型查询加速）
CREATE INDEX IF NOT EXISTS idx_layouts_type ON layouts(slide_type);

-- 触发器：更新时自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_layouts_updated
AFTER UPDATE ON layouts
BEGIN
  UPDATE layouts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ── 初始版式数据 ─────────────────────────────────────────

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('cover_hero', '封面·英雄版', 'cover', '["封面","英雄","左文右色"]', NULL, NULL,
 '["title","subtitle","year"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":8.5,"y":0,"w":4.833,"h":"100%","fill":"theme.cover.accentColor"},{"type":"rect","x":7.2,"y":2.05,"w":0.9,"h":0.82,"fill":"theme.cover.accentColor"},{"type":"image_placeholder","x":7.7,"y":1.75,"w":4.2,"h":3.12,"fill":"#FFFFFF","opacity":0.15,"border":{"color":"#FFFFFF","width":2,"opacity":0.3}},{"type":"rect","x":0.6,"y":1.35,"w":1.8,"h":0.45,"fill":"theme.cover.accentColor"},{"type":"text","x":0.6,"y":1.35,"w":1.8,"h":0.45,"content":"slot.year","color":"#FFFFFF","fontSize":14,"fontWeight":"bold","align":"center","valign":"middle","letterSpacing":2},{"type":"text","x":0.6,"y":1.95,"w":6.8,"h":2.0,"content":"slot.title","color":"theme.cover.bg","fontSize":"theme.font.titleSize+4","fontWeight":"bold","align":"left","valign":"top","wrap":true},{"type":"divider","x":0.6,"y":4.05,"w":0.8,"h":0.05,"color":"theme.cover.accentColor"},{"type":"text","x":0.6,"y":4.2,"w":6.5,"h":0.9,"content":"slot.subtitle","color":"#666666","fontSize":"theme.font.subtitleSize","align":"left","wrap":true,"optional":true},{"type":"rect","x":0.7,"y":5.28,"w":0.45,"h":0.32,"fill":"theme.cover.accentColor"}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('cover_end', '结尾·谢谢', 'end', '["结尾","谢谢"]', NULL, NULL,
 '["title","subtitle","year"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":8.5,"y":0,"w":4.833,"h":"100%","fill":"theme.cover.accentColor"},{"type":"image_placeholder","x":7.7,"y":1.75,"w":4.2,"h":3.12,"fill":"#FFFFFF","opacity":0.15,"border":{"color":"#FFFFFF","width":2,"opacity":0.3}},{"type":"rect","x":0.6,"y":1.35,"w":1.8,"h":0.45,"fill":"theme.cover.accentColor"},{"type":"text","x":0.6,"y":1.35,"w":1.8,"h":0.45,"content":"slot.year","color":"#FFFFFF","fontSize":14,"fontWeight":"bold","align":"center","valign":"middle","letterSpacing":2},{"type":"text","x":0.6,"y":1.95,"w":6.8,"h":2.2,"content":"slot.title","color":"theme.cover.bg","fontSize":"theme.font.titleSize+6","fontWeight":"bold","align":"left","valign":"top","wrap":true},{"type":"divider","x":0.6,"y":4.25,"w":0.8,"h":0.05,"color":"theme.cover.accentColor"},{"type":"text","x":0.6,"y":4.4,"w":6.5,"h":0.9,"content":"slot.subtitle","color":"#666666","fontSize":"theme.font.subtitleSize","align":"left","wrap":true,"optional":true},{"type":"rect","x":0.7,"y":5.28,"w":0.45,"h":0.32,"fill":"theme.cover.accentColor"}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('agenda_grid', '目录·序号格', 'agenda', '["目录","章节","序号"]', 2, 6,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"group","x":0,"y":0,"w":5.0,"h":"100%","fill":"theme.agenda.headerBg","direction":"column","justify":"flex-end","padding":[0,32,40,32],"children":[{"type":"text","content":"literal.ABOUT US","color":"#FFFFFF","fontSize":11,"opacity":0.45,"letterSpacing":2,"marginBottom":8},{"type":"text","content":"slot.subtitle","color":"#FFFFFF","fontSize":13,"opacity":0.7,"wrap":true,"optional":true}]},{"type":"text","x":5.3,"y":0.9,"w":7.5,"h":0.8,"content":"slot.title","color":"theme.agenda.headerBg","fontSize":28,"fontWeight":"bold","align":"left","valign":"middle"},{"type":"text","x":5.3,"y":1.75,"w":5.0,"h":0.4,"content":"literal.Introduce us","color":"theme.cover.accentColor","fontSize":14,"fontWeight":"bold","align":"left"},{"type":"repeat","source":"slot.points","maxItems":6,"layout":"grid","cols":2,"x":5.3,"y":2.3,"w":7.8,"h":3.2,"gap":0.15,"item":{"type":"group","fill":"#F0F4FF","radius":0.06,"direction":"row","align":"center","padding":[0.12,0.15,0.12,0.15],"children":[{"type":"badge","w":0.4,"h":0.4,"shape":"rect","radius":0.04,"fill":"theme.cover.accentColor","content":"slot.index_1","color":"#FFFFFF","fontSize":11,"fontWeight":"bold"},{"type":"text","content":"slot.item","color":"theme.agenda.headerBg","fontSize":12,"fontWeight":"bold","wrap":true,"marginLeft":0.1}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('section_left', '章节·左文底栏', 'section', '["章节","过渡","底栏"]', NULL, NULL,
 '["title","subtitle","chapterNum"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":0,"y":5.1,"w":"100%","h":0.525,"fill":"theme.cover.accentColor"},{"type":"rect","x":5.43,"y":4.71,"w":3.9,"h":0.39,"fill":"#E0E8F5"},{"type":"rect","x":9.43,"y":4.71,"w":3.9,"h":0.39,"fill":"#C8D4E8"},{"type":"text","x":10.0,"y":0.25,"w":2.5,"h":0.5,"content":"slot.chapterNum","color":"theme.agenda.headerBg","fontSize":20,"fontWeight":"bold","align":"right","opacity":0.25},{"type":"rect","x":12.1,"y":1.99,"w":0.47,"h":0.34,"fill":"theme.cover.accentColor"},{"type":"text","x":0.65,"y":1.66,"w":7.2,"h":1.0,"content":"slot.title","color":"theme.agenda.headerBg","fontSize":"theme.font.titleSize-2","fontWeight":"bold","align":"left","valign":"middle","wrap":true},{"type":"text","x":0.68,"y":2.54,"w":5.1,"h":0.5,"content":"slot.subtitle","color":"theme.cover.accentColor","fontSize":16,"fontWeight":"bold","align":"left","optional":true}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_cards', '内容·图标卡片', 'content', '["并列","卡片","特性","优势"]', 3, 4,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#F5F8FF"},{"type":"rect","x":0,"y":0,"w":"100%","h":1.1,"fill":"theme.content.headerBg"},{"type":"text","x":0.5,"y":0.12,"w":8.0,"h":0.85,"content":"slot.title","color":"theme.content.titleColor","fontSize":22,"fontWeight":"bold","align":"left","valign":"middle","wrap":true},{"type":"text","x":8.5,"y":0.12,"w":4.3,"h":0.85,"content":"slot.subtitle","color":"theme.content.titleColor","fontSize":11,"align":"right","valign":"middle","wrap":true,"opacity":0.65,"optional":true},{"type":"repeat","source":"slot.points","maxItems":4,"layout":"grid","cols":"auto","x":0.3,"y":1.2,"w":12.733,"h":4.225,"gap":0.16,"item":{"type":"group","fill":"#FFFFFF","radius":0.08,"shadow":true,"direction":"column","padding":[0.24,0.22,0.24,0.22],"gap":0.12,"children":[{"type":"badge","w":0.45,"h":0.45,"shape":"rect","radius":0.06,"fill":"theme.cover.accentColor","content":"slot.index_1","color":"#FFFFFF","fontSize":12,"fontWeight":"bold"},{"type":"text","content":"slot.item_title","color":"theme.content.headerBg","fontSize":14,"fontWeight":"bold","wrap":true},{"type":"text","content":"slot.item","color":"#555555","fontSize":12,"wrap":true,"lineHeight":1.65}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_stats', '内容·数据三列', 'content', '["数据","指标","三列","统计"]', 2, 3,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":0,"y":0,"w":"100%","h":2.8,"fill":"theme.cover.accentColor"},{"type":"text","x":0.5,"y":0.5,"w":12.333,"h":0.9,"content":"slot.title","color":"#FFFFFF","fontSize":24,"fontWeight":"bold","align":"left","valign":"middle","wrap":true},{"type":"text","x":0.5,"y":1.5,"w":12.333,"h":0.8,"content":"slot.subtitle","color":"#FFFFFF","fontSize":13,"align":"left","wrap":true,"opacity":0.8,"optional":true},{"type":"repeat","source":"slot.points","maxItems":3,"layout":"row","x":0,"y":2.8,"w":"100%","h":2.825,"gap":0,"divider":{"color":"#EEEEEE","width":0.01},"item":{"type":"group","direction":"column","justify":"space-between","padding":[0.35,0.35,0.35,0.35],"children":[{"type":"text","content":"slot.index_1","color":"theme.cover.accentColor","fontSize":11,"fontWeight":"bold","letterSpacing":2},{"type":"text","content":"slot.item_num","color":"theme.cover.accentColor","fontSize":40,"fontWeight":"bold","align":"left"},{"type":"text","content":"slot.item","color":"#333333","fontSize":12,"wrap":true},{"type":"rect","x":0,"y":"bottom","w":"100%","h":0.125,"fill":"theme.cover.accentColor"}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_timeline', '内容·横向流程', 'content', '["步骤","流程","阶段","时间轴"]', 3, 5,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"text","x":0.5,"y":0.4,"w":12.333,"h":0.75,"content":"slot.title","color":"theme.content.headerBg","fontSize":"theme.font.headingSize","fontWeight":"bold","align":"left","valign":"middle","wrap":true},{"type":"text","x":0.5,"y":1.2,"w":12.333,"h":0.4,"content":"slot.subtitle","color":"#999999","fontSize":12,"align":"left","optional":true},{"type":"divider","x":0.8,"y":3.15,"w":11.733,"h":0.04,"color":"theme.cover.accentColor","opacity":0.2},{"type":"rect","x":0,"y":4.95,"w":"100%","h":0.675,"fill":"theme.cover.accentColor"},{"type":"text","x":0.5,"y":4.98,"w":12.333,"h":0.6,"content":"slot.subtitle","color":"#FFFFFF","fontSize":13,"align":"left","valign":"middle","wrap":true,"prefix":"\" ","optional":true},{"type":"repeat","source":"slot.points","maxItems":5,"layout":"row","x":0,"y":2.5,"w":"100%","h":2.35,"gap":0,"item":{"type":"group","direction":"column","align":"center","gap":0.14,"children":[{"type":"badge","w":0.7,"h":0.7,"shape":"circle","fill":"theme.cover.accentColor","content":"slot.index_1","color":"#FFFFFF","fontSize":14,"fontWeight":"bold","shadow":true},{"type":"text","content":"slot.item_title","color":"theme.content.headerBg","fontSize":13,"fontWeight":"bold","align":"center","wrap":true},{"type":"text","content":"slot.item","color":"#555555","fontSize":11,"align":"center","wrap":true,"lineHeight":1.6}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_split', '内容·左右分栏', 'content', '["对比","分栏","左文右色"]', 2, 5,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":5.44,"y":0,"w":7.893,"h":"100%","fill":"theme.cover.accentColor"},{"type":"image_placeholder","x":5.86,"y":0.3,"w":7.1,"h":5.025,"fill":"#FFFFFF","opacity":0.08,"border":{"color":"#FFFFFF","width":1.5,"opacity":0.25}},{"type":"rect","x":0.5,"y":1.1,"w":4.5,"h":1.0,"fill":"theme.cover.accentColor"},{"type":"text","x":0.5,"y":1.1,"w":4.5,"h":1.0,"content":"slot.title","color":"#FFFFFF","fontSize":18,"fontWeight":"bold","align":"left","valign":"middle","padding":[0,12,0,12],"wrap":true},{"type":"text","x":0.5,"y":2.2,"w":4.5,"h":0.5,"content":"slot.subtitle","color":"theme.cover.accentColor","fontSize":12,"fontWeight":"bold","optional":true},{"type":"repeat","source":"slot.points","maxItems":6,"layout":"column","x":0.5,"y":"auto","yStart":2.85,"yStartIfNoSubtitle":2.4,"w":4.7,"h":"auto","maxH":3.0,"gap":0.05,"item":{"type":"group","direction":"row","align":"center","gap":0.15,"children":[{"type":"badge","w":0.12,"h":0.12,"shape":"circle","fill":"theme.cover.accentColor"},{"type":"text","content":"slot.item","color":"#333333","fontSize":12,"wrap":true}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_feature', '内容·左深右列', 'content', '["深色","左右","列表"]', 3, 6,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#FFFFFF"},{"type":"rect","x":0,"y":0,"w":4.2,"h":"100%","fill":"theme.content.headerBg"},{"type":"rect","x":4.16,"y":0,"w":0.06,"h":"100%","fill":"theme.cover.accentColor"},{"type":"text","x":0.4,"y":1.6,"w":3.4,"h":2.0,"content":"slot.title","color":"#FFFFFF","fontSize":24,"fontWeight":"bold","align":"left","valign":"top","wrap":true},{"type":"divider","x":0.4,"y":3.7,"w":0.5,"h":0.05,"color":"theme.cover.accentColor"},{"type":"text","x":0.4,"y":3.85,"w":3.4,"h":1.2,"content":"slot.subtitle","color":"#FFFFFF","fontSize":12,"align":"left","valign":"top","wrap":true,"opacity":0.65,"optional":true},{"type":"repeat","source":"slot.points","maxItems":6,"layout":"column","x":4.5,"y":0.9,"w":8.533,"h":4.425,"gap":0.05,"item":{"type":"group","direction":"row","align":"center","gap":0.15,"children":[{"type":"badge","w":0.38,"h":0.38,"shape":"rect","radius":0.04,"fill":"theme.cover.accentColor","content":"slot.index_1","color":"#FFFFFF","fontSize":11,"fontWeight":"bold"},{"type":"text","content":"slot.item","color":"#333333","fontSize":13,"wrap":true,"lineHeight":1.5}]}}]'
);

INSERT OR REPLACE INTO layouts (id, name, slide_type, tags, point_min, point_max, slots, regions) VALUES
('content_list_accent', '内容·强调列表', 'content', '["列表","强调","左图右文"]', 4, 6,
 '["title","subtitle","points"]',
 '[{"type":"rect","x":0,"y":0,"w":"100%","h":"100%","fill":"#F5F8FF"},{"type":"rect","x":0,"y":0,"w":4.2,"h":"100%","fill":"theme.content.headerBg"},{"type":"rect","x":0,"y":5.5,"w":4.2,"h":0.125,"fill":"theme.cover.accentColor"},{"type":"rect","x":4.2,"y":0,"w":9.133,"h":1.35,"fill":"theme.cover.accentColor"},{"type":"text","x":4.5,"y":0.15,"w":8.5,"h":0.75,"content":"slot.title","color":"#FFFFFF","fontSize":18,"fontWeight":"bold","align":"left","valign":"middle","wrap":true},{"type":"text","x":4.5,"y":0.92,"w":8.5,"h":0.35,"content":"slot.subtitle","color":"#FFFFFF","fontSize":11,"align":"left","opacity":0.75,"optional":true},{"type":"repeat","source":"slot.points","maxItems":6,"layout":"column","x":4.3,"y":1.5,"w":8.833,"h":3.975,"gap":0.05,"item":{"type":"group","fill":"#FFFFFF","radius":0.04,"direction":"row","align":"center","padding":[0,0.12,0,0.12],"borderLeft":{"color":"theme.cover.accentColor","width":0.06},"children":[{"type":"text","content":"slot.index_1","color":"theme.cover.accentColor","fontSize":10,"fontWeight":"bold","w":0.45,"align":"center"},{"type":"text","content":"slot.item","color":"#333333","fontSize":12,"wrap":true,"lineHeight":1.6}]}}]'
);
