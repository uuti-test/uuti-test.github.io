// 网页版：首页 / 答题 / 结果 / 图鉴 / 海报，用地址栏 # 后面的路径切换页面
(function () {
  var U = window.UUTI
  var dims = U.dims, questions = U.questions, copy = U.copy, types = U.types
  var app = document.getElementById('app')

  var UA = navigator.userAgent || ''
  var IS_WECHAT = /MicroMessenger/i.test(UA)
  var IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(UA)
  var myCode = '' // 本次打开页面后自己测出来的人格（浏览器存储不可用时也能认出是自己的结果）

  // 网页版自己的文案（小程序还用 data/copy.js 里的）
  var WEB = {
    title: '测测你是哪种朋友',
    lead: '和绝交多年的好友去旅行，你会怎么做？',
    subtitle: '从张掖出发，一路 15 个名场面\n16 种友情人格，还有 3 种隐藏款等你解锁',
    start: '启程',
    // 节目还没播完
    ongoing: '旅途还在继续，题目和人格会陆续更新'
  }

  // 小火车（朝右开），颜色跟着 CSS 变量走
  var TRAIN =
    '<svg class="train-svg" viewBox="0 0 48 30" aria-hidden="true">' +
      '<circle class="puff p1" cx="10" cy="3" r="2.2"/><circle class="puff p2" cx="6" cy="1.5" r="1.6"/>' +
      '<rect x="8" y="5" width="4" height="6" rx="1" fill="var(--c-ink)"/>' +
      '<rect x="4" y="10" width="30" height="13" rx="2.5" fill="var(--c-accent)"/>' +
      '<rect x="22" y="3" width="12" height="9" rx="1.5" fill="var(--c-accent-dark)"/>' +
      '<rect x="25" y="5.5" width="6" height="4" rx="1" fill="#fff"/>' +
      '<path d="M34 12 L43 16.5 L43 23 L34 23 Z" fill="var(--c-accent-dark)"/>' +
      '<rect x="8" y="13" width="5" height="4" rx="1" fill="#fff"/><rect x="15" y="13" width="5" height="4" rx="1" fill="#fff"/>' +
      '<g fill="var(--c-ink)"><circle cx="10" cy="25" r="3.5"/><circle cx="20" cy="25" r="3.5"/><circle cx="31" cy="25" r="3.5"/></g>' +
      '<g fill="#fff"><circle cx="10" cy="25" r="1.2"/><circle cx="20" cy="25" r="1.2"/><circle cx="31" cy="25" r="1.2"/></g>' +
    '</svg>'

  // 站点：按题目的 stage 分段，例如「📍 张掖 · 集合点」→ 张掖
  var STATIONS = []
  questions.forEach(function (q, i) {
    var name = String(q.stage || '').replace(/^\S+\s+/, '').split(' · ')[0]
    if (/列车/.test(name)) return // 路上的列车段不单独标站，小火车本身就代表它
    if (!STATIONS.length || STATIONS[STATIONS.length - 1].name !== name) STATIONS.push({ name: name, at: i })
  })
  // 节目还没播到的站：用很浅的颜色画在铁轨后半段，和已播出的部分区分开（新一期播出后，把站点挪进题库即可）
  var FUTURE = [{ name: '波密', p: 71 }, { name: '林芝', p: 80 }, { name: '南迦巴瓦', p: 100 }]
  var AIRED = 66 // 已播部分占铁轨的百分比
  var NOW = STATIONS[STATIONS.length - 1] // 目前播到的站
  // 分享链接里用人格的英文代号（小写），比中文编码后短很多，二维码也更好扫：强势大老板型 → boss
  // 旧版短码（JRDP、hidden-fact）仍然能打开
  var LETTER = { 热: 'H', 静: 'J', 直: 'Z', 柔: 'R', 黏: 'N', 独: 'D', 撑: 'C', 破: 'P' }
  function toSlug(code) {
    var t = types.get(code)
    return t && t.en ? t.en.toLowerCase() : oldSlug(code)
  }
  var RENAMED = { tank: 'bigsis', atm: 'loss', tsun: 'soft', zen: 'calm', u1st: 'curly', giver: 'curly', never: 'melt', dps: 'fire' }
  function oldSlug(code) {
    var h = types.hidden.filter(function (x) { return x.code === code })[0]
    if (h) return 'hidden-' + h.tag
    return code.split('').map(function (c) { return LETTER[c] || c }).join('')
  }
  // 接受中文代码或英文短码
  function typeOf(s) {
    if (!s) return null
    if (types.get(s)) return types.get(s)
    var all = types.list.concat(types.hidden)
    var low = String(s).toLowerCase()
    low = RENAMED[low] || low
    for (var i = 0; i < all.length; i++) if (toSlug(all[i].code) === low || oldSlug(all[i].code) === s) return all[i]
    return null
  }
  function railPos(i) { return questions.length > 1 ? i / (questions.length - 1) * AIRED : 0 }

  // ---------- 小工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem('uuti_' + key))
      localStorage.setItem('uuti_' + key, JSON.stringify(val))
    } catch (e) { return null }
  }
  function img(t) { return t.image ? t.image.replace(/^\//, '') : '' }
  // 浅色底（黄色、浅绿等）上白字看不清，改用深色字
  function onColor(hex) {
    var n = parseInt(hex.slice(1), 16)
    var l = ((n >> 16) * 299 + ((n >> 8 & 255) * 587) + (n & 255) * 114) / 1000
    return l > 170 ? '#2D2A26' : '#fff'
  }
  function tint(hex, a) {
    var n = parseInt(hex.slice(1), 16)
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
  }
  // 头像：size 是宽度（px），有图按竖图比例显示
  function avatar(t, size) {
    if (img(t)) {
      return '<div class="avatar" style="width:' + size + 'px;height:' + Math.round(size * 1.15) + 'px"><img src="' + esc(img(t)) + '" alt="' + esc(t.name) + '"></div>'
    }
    var d = Math.round(size * 0.8)
    return '<div class="avatar" style="width:' + size + 'px"><div class="circle" style="width:' + d + 'px;height:' + d + 'px;background:' + tint(t.color, 0.14) + ';color:' + t.color + ';font-size:' + Math.round(d * 0.4) + 'px">' + esc(t.name.slice(0, 1)) + '</div></div>'
  }
  var toastTimer
  function toast(text) {
    var el = document.getElementById('toast')
    el.textContent = text
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { el.classList.remove('show') }, 1800)
  }
  function go(hash) { location.hash = hash }
  function parse() {
    var h = location.hash.replace(/^#/, '') || '/'
    var i = h.indexOf('?')
    var route = i < 0 ? h : h.slice(0, i)
    var q = {}
    if (i >= 0) h.slice(i + 1).split('&').forEach(function (p) {
      var kv = p.split('=')
      if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || '')
    })
    return { route: route, q: q }
  }
  // 分享链接和海报二维码都固定指向 GitHub 上的正式网站（本地预览时也一样）
  var SITE = 'https://uuti-test.github.io/'

  // ---------- 访问统计（GoatCounter，免费、不用 cookie、不收集个人信息）----------
  // 在 goatcounter.com 注册后，把你的代号填在这里（例如 'uuti'），后台在 https://代号.goatcounter.com
  // 留空就不统计；只在正式网站上统计，本地预览不算
  var GOATCOUNTER = 'uuti'
  var STATS_ON = !!GOATCOUNTER && location.hostname === 'uuti-test.github.io'
  var statQueue = []
  if (STATS_ON) {
    window.goatcounter = { no_onload: true }
    var gs = document.createElement('script')
    gs.async = true
    gs.src = 'https://gc.zgo.at/count.js'
    gs.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER + '.goatcounter.com/count')
    gs.onload = function () { statQueue.splice(0).forEach(stat) }
    document.head.appendChild(gs)
  }
  // path 是后台显示的名字；event = true 表示是一次「事件」（做完测试、生成海报等），不是打开页面
  function stat(o) {
    if (!STATS_ON) return
    if (!window.goatcounter || !window.goatcounter.count) return statQueue.push(o)
    try { window.goatcounter.count(o) } catch (e) {}
  }
  function siteUrl() { return SITE }
  function shuffle(arr) {
    var a = arr.slice()
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }
  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done) })
    } else fallbackCopy(text, done)
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    var ok = false
    try { ok = document.execCommand('copy') } catch (e) {}
    if (ok) done()
    else toast('复制失败，请长按上面的文字手动复制')
    document.body.removeChild(ta)
  }

  // ---------- 首页 ----------
  function home(q) {
    var friend = typeOf(q.from)
    document.title = '测测你是哪种朋友'
    var first = STATIONS[0]
    app.innerHTML =
      '<div class="home">' +
        '<div class="hero">' +
          '<div class="brand">uuti</div>' +
          '<h1 class="title">' + esc(WEB.title) + '</h1>' +
          '<div class="lead">' + esc(WEB.lead) + '</div>' +
          '<div class="subtitle quiet">' + esc(WEB.subtitle) + '</div>' +
          '<div class="ongoing"><i></i>' + esc(WEB.ongoing) + '</div>' +
        '</div>' +
        // 乘客：16 种人格的小人排成一列，像车窗外一节节开过去（隐藏人格不露脸）
        '<div class="parade" aria-hidden="true"><div class="parade-in">' +
          [0, 1].map(function () {
            return types.list.filter(function (t) { return img(t) }).map(function (t) {
              return '<div class="rider" style="background:' + tint(t.color, 0.14) + '"><img src="' + esc(img(t)) + '" alt=""></div>'
            }).join('')
          }).join('') +
        '</div></div>' +
        // 车票
        '<div class="ticket">' +
          '<div class="ticket-top"><span>车次 U2026</span><span>' + '单程 · 不可退票' + '</span></div>' +
          '<div class="ticket-route">' +
            '<div><div class="quiet small">始发</div><div class="city">' + esc(first.name) + '</div></div>' +
            '<div class="ticket-track"><div class="ticket-line"></div>' + TRAIN + '</div>' +
            '<div class="right"><div class="quiet small">当前到站</div><div class="city">' + esc(NOW.name) + '</div></div>' +
          '</div>' +
          '<div class="ticket-cut"></div>' +
          '<div class="ticket-bottom"><span>' + questions.length + ' 站名场面</span><span>约 3 分钟</span></div>' +
        '</div>' +
        (friend ? '<div class="card"><div class="quiet small">你的朋友是</div><div class="friend-name">' + esc(friend.name) + '</div><div class="quiet small">测完就能看到你们的合拍度</div></div>' : '') +
        '<div>' +
          '<button class="btn" id="start">' + (friend ? '测测我们合不合拍' : esc(WEB.start)) + '</button>' +
          '<div class="links"><button class="link" id="atlas">人格图鉴</button></div>' +
          '<div class="center quiet small meta">' + esc(copy.disclaimer) + '</div>' +
        '</div>' +
      '</div>'
    document.getElementById('start').onclick = function () { go('/quiz' + (friend ? '?from=' + toSlug(friend.code) : '')) }
    document.getElementById('atlas').onclick = function () { go('/atlas') }
  }

  // ---------- 答题 ----------
  function quiz(q) {
    var from = q.from || ''
    var answers = []
    var orders = questions.map(function (x) { return shuffle(x.options) })
    var busy = false
    document.title = '答题中 · 测测你是哪种朋友'

    function render(index) {
      var question = questions[index]
      var cheer = copy.cheers[index] || ''
      var sel = answers[index]
      var pos = railPos(index)
      var cur = 0
      STATIONS.forEach(function (s, k) { if (s.at <= index) cur = k })
      app.innerHTML =

        // 铁轨进度条：小火车按题号往前开，经过的站点点亮
        '<div class="rail">' +
          '<div class="rail-track"><div class="rail-aired" style="width:' + AIRED + '%"></div><div class="rail-future" style="left:' + AIRED + '%"></div>' +
            '<div class="rail-done" style="width:' + pos + '%"></div>' +
            STATIONS.map(function (s, k) {
              var p = railPos(s.at)
              var align = k === 0 ? 'first' : ''
              return '<div class="station ' + (s.at <= index ? 'passed ' : '') + (k === cur ? 'cur ' : '') + align + '" style="left:' + p + '%">' +
                '<i></i><span>' + esc(s.name) + '</span></div>'
            }).join('') +
            FUTURE.map(function (s) {
              return '<div class="station future' + (s.p === 100 ? ' last' : '') + '" style="left:' + s.p + '%"><i></i><span>' + esc(s.name) + '</span></div>'
            }).join('') +
            '<div class="rail-train" style="left:' + pos + '%">' + TRAIN + '</div>' +
          '</div>' +
        '</div>' +
        // 站牌：上面是站名，下面是这一站的题目
        '<div class="q-card">' +
          '<div class="q-sign"><span>' + esc(question.stage) + '</span><b>' + (index + 1) + '<small> / ' + questions.length + '</small></b></div>' +
          '<div class="q-text">' + esc(question.text) + '</div>' +
        '</div>' +
        '<div class="options">' +
        orders[index].map(function (o, k) {
          return '<button class="option' + (sel === o.score ? ' on' : '') + '" data-k="' + k + '"><i>' + 'ABCD'[k] + '</i><span>' + esc(o.text) + '</span></button>'
        }).join('') +
        '</div>' +
        (cheer ? '<div class="cheer">' + esc(cheer) + '</div>' : '') +
        // 每题底部都有返回：第 1 题回首页，之后回上一题（之前选的答案会保留）
        '<button class="back-btn" id="prev">‹ ' + (index > 0 ? '返回上一题' : '返回首页') + '</button>'
      document.getElementById('prev').onclick = function () {
        if (busy) return
        if (index > 0) render(index - 1)
        else go('/' + (from ? '?from=' + encodeURIComponent(from) : ''))
      }
      Array.prototype.forEach.call(app.querySelectorAll('.option'), function (btn) {
        // 选中后其他选项变淡

        btn.onclick = function () {
          if (busy) return
          var o = orders[index][Number(btn.getAttribute('data-k'))]
          answers[index] = o.score
          btn.classList.add('on')
          btn.parentNode.classList.add('picked')
          busy = true
          setTimeout(function () {
            busy = false
            if (index < questions.length - 1) render(index + 1)
            else finish()
          }, 220)
        }
      })
      window.scrollTo(0, 0)
    }

    function finish() {
      var r = U.scoring.score(questions, answers)
      var code = r.hidden || r.code
      myCode = code
      var tt = types.get(code)
      stat({ path: '做完测试', title: '做完测试', event: true })
      stat({ path: '测出 ' + (tt ? tt.en + ' ' + tt.name : code), title: '测出的人格', event: true })
      if (from) stat({ path: '好友邀请后做完', title: '好友邀请后做完', event: true })
      store('lastResult', { code: code, base: r.code, pct: r.pct, time: Date.now() })
      if (r.hidden) {
        var found = store('hiddenFound') || []
        if (found.indexOf(code) < 0) store('hiddenFound', found.concat(code))
      }
      app.innerHTML = '<div class="analyzing"><div class="drive"><div class="drive-train">' + TRAIN + '</div><div class="drive-line"></div></div><div class="quiet">' +
        esc(r.hidden ? '等等……好像触发了什么隐藏彩蛋？' : copy.analyzing) + '</div></div>'
      setTimeout(function () { location.replace('#' + resultHash(code, r.code, r.pct, from)) }, 1800)
    }

    render(0)
  }

  function resultHash(code, base, pct, from) {
    return '/result?code=' + encodeURIComponent(code) + '&base=' + encodeURIComponent(base || code) +
      '&pct=' + (pct || []).join(',') + (from ? '&from=' + encodeURIComponent(from) : '')
  }

  // ---------- 结果 / 人格详情 ----------
  function result(q, view) {
    var code = q.code || ''
    var t = types.get(code)
    if (!t) return go('/')
    // 别人转发过来的结果页链接（不是自己测出来的）→ 当成邀请，打开首页
    if (!view) {
      var last = store('lastResult')
      var mine = myCode || (last && last.code)
      if (mine !== code) return location.replace('#/?from=' + toSlug(code))
    }
    var secret = types.isHidden(code)
    var real = q.base || code
    var pct = (q.pct || '').split(',').map(Number)
    var bars = view || pct.length !== 4 || real.length !== 4 ? [] : dims.map(function (d, k) {
      return { name: d.name, a: d.a.label, b: d.b.label, pa: pct[k], towardA: real[k] === d.a.char }
    })
    var friend = !view ? typeOf(q.from) : null
    var match = null
    if (friend) {
      var s = U.match.matchScore(code, friend.code)
      match = { score: s, text: U.match.comment(s) }
    }
    // 微信里点右上角 ··· 转发时，卡片标题用的就是网页标题
    document.title = view ? t.name + ' · 测测你是哪种朋友' : copy.shareTitle(t.name)

    app.innerHTML =
      (view ? '<button class="link back" id="back">‹ 返回</button>' : '') +
      '<div class="head">' +
        (secret && !view ? '<div class="secret-badge">触发隐藏人格 · 观察室限定</div>' : (!view ? '<div class="quiet small">你的友情人格是</div>' : '')) +
        '<div style="margin-top:12px">' + avatar(t, 160) + '</div>' +
        (t.en ? '<div class="en" style="color:' + t.color + '">' + esc(t.en) + '</div>' : '') +
        '<div class="name">' + esc(t.name) + '</div>' +
        '<div class="slogan">' + esc(t.slogan) + '</div>' +
        (!view ? '<button class="poster-btn" id="poster" style="background:' + t.color + ';color:' + onColor(t.color) + '">生成我的人格海报</button>' : '') +
      '</div>' +
      (match ? '<div class="card match"><div class="quiet small">你和「' + esc(friend.name) + '」的合拍度</div><div class="match-score" style="color:' + t.color + '">' + match.score + '%</div><div class="small">' + esc(match.text) + '</div></div>' : '') +
      (t.quote ? '<div class="quote" style="border-color:' + t.color + '"><span class="quiet small">金句</span><div>「' + esc(t.quote) + '」</div></div>' : '') +
      '<div class="block"><div>' + esc(t.desc) + '</div></div>' +
      (t.scenes && t.scenes.length ? '<div class="block"><div class="section-title">你的名场面</div>' +
        '<div class="scenes">' + t.scenes.map(function (x, i) {
          return '<div class="scene"><i style="background:' + t.color + '">' + (i + 1) + '</i><span>' + esc(x) + '</span></div>'
        }).join('') + '</div></div>' : '') +
      '<div class="block"><div class="section-title">完整报告</div>' +
        '<div class="sub">友情优势</div>' + t.strengths.map(function (x) { return '<div class="li">' + esc(x) + '</div>' }).join('') +
        '<div class="sub">友情雷区</div>' + t.pitfalls.map(function (x) { return '<div class="li">' + esc(x) + '</div>' }).join('') +
        (t.review ? '<div class="sub">观察室锐评</div><div class="review">' + esc(t.review) + '</div>' : '') +
      '</div>' +
      '<div class="footer">' +
        (view
          ? '<button class="btn" id="test">测测我是哪种人格</button>'
          : '<button class="btn" id="share">发给朋友，测测合不合拍</button>' +
            '<div class="links"><button class="link" id="atlas">人格图鉴</button><button class="link" id="retest">重新测试</button></div>') +
        '<div class="center quiet small disclaimer">' + esc(copy.disclaimer) + '</div>' +
      '</div>'

    if (view) {
      document.getElementById('back').onclick = function () { history.length > 1 ? history.back() : go('/atlas') }
      document.getElementById('test').onclick = function () { go('/') }
    } else {
      document.getElementById('share').onclick = function () { share(t) }
      document.getElementById('poster').onclick = function () { poster(t) }
      document.getElementById('atlas').onclick = function () { go('/atlas') }
      document.getElementById('retest').onclick = function () { go('/quiz') }
    }
    window.scrollTo(0, 0)
  }

  // 维度标签：慢热 · 含蓄 · 独立 · 破防；隐藏人格显示「观察室隐藏款」
  function dimChips(t) {
    if (types.isHidden(t.code)) return ['观察室隐藏款']
    return dims.map(function (d, k) { return t.code[k] === d.a.char ? d.a.label : d.b.label })
  }
  // 分享用落地页 t/<代号>：链接预览能显示人格小人图，打开后自动跳到首页并带上人格
  function inviteUrl(t) { var t2 = types.get(t.code); return t2 && t2.en ? siteUrl() + 't/' + t2.en.toLowerCase() : siteUrl() + '#/?from=' + toSlug(t.code) }

  // 分享面板：微信里不能直接调起分享，所以三条路都给：
  // ① 系统分享（手机浏览器）② 复制链接（链接直接显示出来，复制失败也能长按复制）③ 微信右上角转发 / 发海报
  function share(t) {
    var url = inviteUrl(t)
    var title = copy.shareTitle(t.name)
    var text = title + ' ' + url
    var canSystem = !!navigator.share && !IS_WECHAT
    var sheet = document.createElement('div')
    sheet.className = 'mask sheet-mask'
    sheet.innerHTML =
      '<div class="sheet">' +
        '<div class="sheet-title">发给朋友，测测合不合拍</div>' +
        '<div class="quiet small">朋友打开链接测完，就能看到你们俩的合拍度</div>' +
        '<textarea class="share-text" readonly rows="3">' + esc(text) + '</textarea>' +
        '<button class="btn" id="copy">复制链接</button>' +
        (canSystem ? '<button class="btn ghost" id="sys">用其他 App 分享</button>' : '') +
        '<button class="btn ghost" id="toPoster">生成海报发给朋友</button>' +
        (IS_WECHAT ? '<div class="quiet small center">也可以点右上角 ··· 直接转发给朋友</div>' : '') +
        '<button class="link sheet-close" id="close">取消</button>' +
      '</div>'
    document.body.appendChild(sheet)
    var close = function () { if (sheet.parentNode) sheet.parentNode.removeChild(sheet) }
    var ta = sheet.querySelector('.share-text')
    sheet.querySelector('#copy').onclick = function () {
      ta.focus(); ta.select(); ta.setSelectionRange(0, text.length)
      copyText(text, function () { toast('已复制，去微信粘贴给朋友吧'); close() })
    }
    if (canSystem) sheet.querySelector('#sys').onclick = function () {
      navigator.share({ title: title, text: title, url: url }).then(close).catch(function () {})
    }
    stat({ path: '打开分享', title: '打开分享', event: true })
    sheet.querySelector('#toPoster').onclick = function () { close(); poster(t) }
    sheet.querySelector('#close').onclick = close
    sheet.onclick = function (e) { if (e.target === sheet) close() }
  }

  // ---------- 图鉴 ----------
  function atlas() {
    var found = store('hiddenFound') || []
    document.title = '人格图鉴 · 测测你是哪种朋友'
    app.innerHTML =
      '<button class="link back" id="home">‹ 首页</button>' +
      '<div class="page-title">人格图鉴</div>' +
      '<div class="ongoing atlas-note"><i></i>' + esc(WEB.ongoing) + '</div>' +
      '<div class="grid">' + types.list.map(function (t) {
        return '<div class="cell" data-code="' + esc(t.code) + '">' + avatar(t, 72) + '<div class="cell-en" style="color:' + t.color + '">' + esc(t.en || '') + '</div><div class="cell-name">' + esc(t.name) + '</div></div>'
      }).join('') + '</div>' +
      '<div class="secret-title">观察室隐藏款</div>' +
      '<div class="grid">' + types.hidden.map(function (t) {
        var ok = found.indexOf(t.code) >= 0
        return '<div class="cell" data-code="' + esc(t.code) + '" data-found="' + (ok ? 1 : 0) + '">' +
          (ok ? avatar(t, 72) + '<div class="cell-en" style="color:' + t.color + '">' + esc(t.en || '') + '</div><div class="cell-name">' + esc(t.name) + '</div>' : '<div class="mystery">?</div><div class="cell-name quiet">未解锁</div>') + '</div>'
      }).join('') + '</div>'
    document.getElementById('home').onclick = function () { go('/') }
    Array.prototype.forEach.call(app.querySelectorAll('.cell'), function (el) {
      el.onclick = function () {
        if (el.getAttribute('data-found') === '0') return toast('观察室限定，答题时可能触发哦')
        go('/type?code=' + encodeURIComponent(el.getAttribute('data-code')))
      }
    })
    window.scrollTo(0, 0)
  }

  // ---------- 海报：车票样式，底部存根带二维码（扫码打开网站，并带上你的人格，朋友测完能看合拍度）----------
  var W = 300, H = 533
  var FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null)
      var im = new Image()
      im.onload = function () { resolve(im) }
      im.onerror = function () { resolve(null) }
      im.src = src
    })
  }
  // 按宽度换行，返回画完后的 y
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var line = '', lines = 0
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i]
      if (ctx.measureText(test).width > maxWidth && line && !/[。，！？、；：」』）”…]/.test(text[i])) {
        lines++
        if (lines === maxLines) { ctx.fillText(line.slice(0, -1) + '…', x, y); return y + lineHeight }
        ctx.fillText(line, x, y)
        line = text[i]
        y += lineHeight
      } else line = test
    }
    if (line) ctx.fillText(line, x, y)
    return y + lineHeight
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
  function drawQR(ctx, text, x, y, size) {
    if (typeof window.qrcode !== 'function') return false
    var qr = window.qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    var n = qr.getModuleCount()
    var cell = size / n
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, size, size)
    ctx.fillStyle = '#1F1F1F'
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell))
      }
    }
    return true
  }

  // 抠图：小人图是白底，从图片四边开始把连着边缘的白底变透明（人物身上的白色衣服不受影响），
  // 这样背后的英文字母不会透到人物身上；边缘一圈半透明，避免锯齿
  function cutout(im) {
    try {
      var c = document.createElement('canvas')
      var w = c.width = im.width, h = c.height = im.height
      var x = c.getContext('2d')
      x.drawImage(im, 0, 0)
      var d = x.getImageData(0, 0, w, h), p = d.data
      var bg = new Uint8Array(w * h), stack = []
      var light = function (i) { var k = i * 4; return Math.min(p[k], p[k + 1], p[k + 2]) }
      for (var i = 0; i < w; i++) { stack.push(i, (h - 1) * w + i) }
      for (var j = 0; j < h; j++) { stack.push(j * w, j * w + w - 1) }
      while (stack.length) {
        var n = stack.pop()
        if (bg[n] || light(n) < 228) continue
        bg[n] = 1
        var px = n % w, py = (n - px) / w
        if (px > 0) stack.push(n - 1)
        if (px < w - 1) stack.push(n + 1)
        if (py > 0) stack.push(n - w)
        if (py < h - 1) stack.push(n + w)
      }
      for (var m = 0; m < w * h; m++) {
        if (bg[m]) { p[m * 4 + 3] = 0; continue }
        var mx = m % w
        var edge = (mx > 0 && bg[m - 1]) || (mx < w - 1 && bg[m + 1]) || (m >= w && bg[m - w]) || (m < w * (h - 1) && bg[m + w])
        if (edge) { var l = light(m); if (l > 180) p[m * 4 + 3] = Math.round(255 * (228 - Math.min(l, 228)) / 48 + 0) }
      }
      x.putImageData(d, 0, 0)
      // 裁掉四周空白，只留人物，方便把脚放在阴影上
      var x0 = w, y0 = h, x1 = -1, y1 = -1
      for (var q = 0; q < w * h; q++) {
        if (p[q * 4 + 3] < 40) continue
        var qx = q % w, qy = (q - qx) / w
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy
      }
      if (x1 < 0) return c
      var t2 = document.createElement('canvas')
      t2.width = x1 - x0 + 1; t2.height = y1 - y0 + 1
      t2.getContext('2d').drawImage(c, x0, y0, t2.width, t2.height, 0, 0, t2.width, t2.height)
      return t2
    } catch (e) { return im }
  }

  // 海报上的路线：按节目行程，已播出的站实心，没播到的站很浅；终点南迦巴瓦也画上
  var ROUTE = [
    { name: '张掖', aired: true },
    { name: '拉萨', aired: true, now: true },
    { name: '波密' },
    { name: '林芝' },
    { name: '南迦巴瓦' }
  ]

  function poster(t) {
    var canvas = document.createElement('canvas')
    var scale = 3
    canvas.width = W * scale
    canvas.height = H * scale
    var ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    var hidden = types.isHidden(t.code)
    var link = inviteUrl(t)
    var INK = '#1F1F1F', QUIET = '#9A9A96', PALE = '#D9D9D5'

    stat({ path: '生成海报', title: '生成海报', event: true })
    toast('海报生成中…')
    loadImage(img(t)).then(function (im) {
      ctx.textBaseline = 'alphabetic'
      // 背景：人格色由深到浅的渐变 + 细点阵
      var bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, tint(t.color, 0.34))
      bg.addColorStop(1, tint(t.color, 0.12))
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = tint(t.color, 0.22)
      for (var r = 0, dy = 7; dy < H; r++, dy += 13) {
        for (var dx = 7 + (r % 2) * 6.5; dx < W; dx += 13) { ctx.beginPath(); ctx.arc(dx, dy, 0.8, 0, Math.PI * 2); ctx.fill() }
      }

      // 车票主体：白色圆角卡片 + 柔和阴影
      var X = 18, Y = 20, CW = W - 36, CH = H - 40
      var cutY = Y + CH - 72
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
      ctx.fillStyle = '#FFFFFF'; roundRect(ctx, X, Y, CW, CH, 16); ctx.fill()
      ctx.restore()

      // 票头
      ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = 'bold 11px ' + FONT
      ctx.fillText('UUTI 友情列车', X + 16, Y + 26)
      ctx.textAlign = 'right'; ctx.fillStyle = QUIET; ctx.font = '10px ' + FONT
      ctx.fillText('车次 U2026 · 旅途进行中', X + CW - 16, Y + 26)

      // 路线
      var rx0 = X + 26, rx1 = X + CW - 26, ry = Y + 52
      var at = [0, 0.3, 0.58, 0.79, 1]
      var px = function (k) { return rx0 + (rx1 - rx0) * at[k] }
      var nowX = px(1)
      ctx.strokeStyle = PALE; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(nowX, ry); ctx.lineTo(rx1, ry); ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = t.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(nowX, ry); ctx.stroke()
      ROUTE.forEach(function (s, k) {
        var x = px(k)
        if (s.now) {
          ctx.fillStyle = tint(t.color, 0.25); ctx.beginPath(); ctx.arc(x, ry, 7, 0, Math.PI * 2); ctx.fill()
        }
        ctx.beginPath(); ctx.arc(x, ry, s.aired ? 3.5 : 3, 0, Math.PI * 2)
        if (s.aired) { ctx.fillStyle = t.color; ctx.fill() } else { ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = PALE; ctx.lineWidth = 1.2; ctx.stroke() }
        ctx.textAlign = 'center'
        ctx.fillStyle = s.aired ? INK : PALE; ctx.font = (s.aired ? 'bold ' : '') + '10px ' + FONT
        ctx.fillText(s.name, x, ry + 19)
      })
      // 「当前」小标签
      ctx.font = 'bold 8px ' + FONT
      ctx.fillStyle = t.color; roundRect(ctx, nowX - 13, ry - 22, 26, 12, 6); ctx.fill()
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText('当前', nowX, ry - 13)

      // 小人：先画大号英文代号水印，再把抠好图的小人画在上面（字母在人物后面）
      var iy = Y + 86, ih = 182
      var en = t.en || ''
      if (en) {
        ctx.font = '900 100px ' + FONT
        var ew = ctx.measureText(en).width
        var fs = Math.min(100, 100 * (CW - 24) / ew)
        ctx.font = '900 ' + fs + 'px ' + FONT
        ctx.fillStyle = tint(t.color, 0.16); ctx.textAlign = 'center'
        ctx.fillText(en, W / 2, iy + ih * 0.5 + fs * 0.36)
      }
      // 人物裁掉空白后，脚底对齐 footY，阴影的中心就在脚底，宽度跟着人物走
      var footY = iy + ih - 6
      if (im) {
        im = cutout(im)
        var s = Math.min((CW - 80) / im.width, (ih - 12) / im.height)
        var w = im.width * s, h = im.height * s
        if (!t.noShadow) {
          ctx.fillStyle = tint(t.color, 0.22)
          ctx.beginPath(); ctx.ellipse(W / 2, footY - 1, Math.max(36, Math.min(80, w * 0.48)), 6, 0, 0, Math.PI * 2); ctx.fill()
        }
        ctx.drawImage(im, W / 2 - w / 2, footY - h, w, h)
      } else {
        ctx.fillStyle = tint(t.color, 0.22)
        ctx.beginPath(); ctx.ellipse(W / 2, footY - 1, 60, 6, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = tint(t.color, 0.24)
        ctx.beginPath(); ctx.arc(W / 2, iy + ih / 2, 58, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = t.color; ctx.textAlign = 'center'; ctx.font = 'bold 48px ' + FONT
        ctx.fillText(t.name.slice(0, 1), W / 2, iy + ih / 2 + 17)
      }

      // 人格名
      ctx.textAlign = 'center'
      var y = iy + ih + 14
      // 英文代号胶囊（隐藏人格多一个「观察室限定」）
      var pill = (hidden ? '隐藏人格 · ' : '') + (en || '我的友情人格')
      ctx.font = 'bold 10px ' + FONT
      var pw = ctx.measureText(pill).width + 20
      ctx.fillStyle = t.color; roundRect(ctx, W / 2 - pw / 2, y, pw, 18, 9); ctx.fill()
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(pill, W / 2, y + 12.5)
      y += 46
      ctx.fillStyle = INK; ctx.font = 'bold 25px ' + FONT
      ctx.fillText(t.name, W / 2, y)

      // 金句：两侧引号
      y += 40
      ctx.font = 'bold 13px ' + FONT
      var qText = t.quote || t.slogan
      var two = ctx.measureText(qText.replace(/[。，！？…]$/, '')).width > CW - 70
      ctx.fillStyle = tint(t.color, 0.5); ctx.font = 'bold 30px Georgia, serif'
      ctx.textAlign = 'left'; ctx.fillText('“', X + 16, y + 8)
      ctx.textAlign = 'right'; ctx.fillText('”', X + CW - 16, y + (two ? 27 : 8))
      ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = 'bold 13px ' + FONT
      wrapText(ctx, qText, W / 2, y, CW - 70, 19, 2)
      y += two ? 38 : 19
      // 标语：有空间就放一行
      if (t.quote && t.slogan !== t.quote && cutY - 16 - y > 14) {
        ctx.fillStyle = QUIET; ctx.font = '10.5px ' + FONT
        wrapText(ctx, t.slogan, W / 2, y + 6, CW - 50, 16, 1)
      }

      // 存根：两侧半圆缺口 + 虚线
      ;[X, X + CW].forEach(function (cx) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cutY, 8, 0, Math.PI * 2); ctx.clip()
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx - 9, cutY - 9, 18, 18)
        ctx.fillStyle = bg; ctx.fillRect(cx - 9, cutY - 9, 18, 18)
        ctx.restore()
      })
      ctx.strokeStyle = '#E2E2DE'; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(X + 14, cutY); ctx.lineTo(X + CW - 14, cutY); ctx.stroke()
      ctx.setLineDash([])

      // 存根：左边文字，右边小二维码
      var qs = 46, qx = X + CW - 18 - qs, qy = cutY + 13
      var hasQR = drawQR(ctx, link, qx, qy, qs)
      var tx = X + 20
      ctx.textAlign = 'left'
      ctx.fillStyle = INK; ctx.font = 'bold 12.5px ' + FONT
      ctx.fillText(hasQR ? '扫码测测你是哪种朋友' : '来测测你是哪种朋友', tx, qy + 14)
      ctx.fillStyle = QUIET; ctx.font = '10px ' + FONT
      ctx.fillText('测完看看我们合不合拍', tx, qy + 30)
      ctx.fillStyle = t.color; ctx.font = 'bold 9.5px ' + FONT
      ctx.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), tx, qy + 44)

      var url
      try { url = canvas.toDataURL('image/png') } catch (e) { return toast('海报生成失败') }
      showPoster(t, url, canvas)
    })
  }

  // 海报弹层：手机上引导长按保存到相册；支持的浏览器直接调起系统「存储图像」；电脑上下载
  function showPoster(t, url, canvas) {
    var mask = document.createElement('div')
    mask.className = 'mask'
    var hint = IS_WECHAT
      ? '长按海报 → 选择「保存图片」，就能存到相册'
      : (IS_MOBILE ? '长按海报保存到相册，或点下面的按钮' : '点下面的按钮保存海报')
    mask.innerHTML =
      '<img src="' + url + '" alt="' + esc(t.name) + ' 海报">' +
      '<div class="hint">' + hint + '</div>' +
      (IS_WECHAT ? '' : '<button class="btn" id="save">' + (IS_MOBILE ? '保存到相册' : '保存海报') + '</button>') +
      '<button class="btn ghost" id="close">关闭</button>'
    document.body.appendChild(mask)
    var close = function () { if (mask.parentNode) mask.parentNode.removeChild(mask) }
    mask.querySelector('#close').onclick = close
    mask.onclick = function (e) { if (e.target === mask) close() }
    var save = mask.querySelector('#save')
    if (!save) return
    save.onclick = function () {
      canvas.toBlob(function (blob) {
        var name = t.name + '.png'
        var file = blob && typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
        // 手机浏览器：系统分享面板里有「存储图像 / 保存到相册」
        if (IS_MOBILE && file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file] }).catch(function () {})
          return
        }
        if (IS_MOBILE) { toast('长按上面的海报，就能保存到相册'); return }
        // 电脑：下载图片
        var a = document.createElement('a')
        a.href = url; a.download = name
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      }, 'image/png')
    }
  }

  // ---------- 路由 ----------
  function route() {
    var p = parse()
    var old = document.querySelector('.mask')
    if (old) old.parentNode.removeChild(old)
    // 每次切页面记一次访问：首页 / 答题 / 结果 / 人格详情 / 图鉴；从分享链接进来的首页单独记
    stat({ path: p.route === '/' && p.q.from ? '/?from=好友邀请' : p.route, title: document.title })
    if (p.route === '/quiz') quiz(p.q)
    else if (p.route === '/result') result(p.q, false)
    else if (p.route === '/type') result(p.q, true)
    else if (p.route === '/atlas') atlas()
    else home(p.q)
  }
  window.addEventListener('hashchange', route)
  route()
})()
