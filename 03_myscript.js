console.log("poke_gacha_script 로드 완료");

// ══════════════════════════════════════════════
// 희귀도 기준 정의
// ══════════════════════════════════════════════

// LEGENDARY : 전설 포켓몬 ID
const LEGENDARY_IDS = new Set([
  144,145,146,150,151,        // 새, 뮤츠, 뮤
  243,244,245,249,250,251,    // 2세대
  377,378,379,380,381,382,383,384,385,386, // 3세대
  480,481,482,483,484,485,486,487,488,489,490,491,492,493, // 4세대
  494,638,639,640,641,642,643,644,645,646,647,648,649,     // 5세대
  716,717,718,719,720,721,    // 6세대
  785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,
  801,802,803,804,805,806,807, // 7세대
  888,889,890,891,892,893,894,895,896,897,898, // 8세대
  905,999,1000,1001,1002,1003,1004,           // 9세대
]);

// EPIC : 600 이상 합계 스탯 (의사전설) — 런타임에 판정
const EPIC_STAT_THRESHOLD = 580;

// RARE : 진화 2단계이거나 스탯 합 450 이상
const RARE_STAT_THRESHOLD = 450;

function getRarity(data) {
  if (LEGENDARY_IDS.has(data.id)) return "legendary";
  const totalStat = data.stats.reduce((s, x) => s + x.base_stat, 0);
  if (totalStat >= EPIC_STAT_THRESHOLD) return "epic";
  if (totalStat >= RARE_STAT_THRESHOLD) return "rare";
  return "normal";
}

const RANK_LABEL = {
  normal:    "NORMAL",
  rare:      "⭐ RARE",
  epic:      "💎 EPIC",
  legendary: "✨ LEGENDARY",
};

// ══════════════════════════════════════════════
// DOM
// ══════════════════════════════════════════════
const gachaBtn     = document.querySelector("#gachaBtn");
const btnText      = document.querySelector("#btnText");
const pokeball     = document.querySelector("#pokeball");
const pokeballWrap = document.querySelector("#pokeballWrap");
const resultCard   = document.querySelector("#resultCard");
const gachaBox     = document.querySelector("#gachaBox");
const pokeImg      = document.querySelector("#pokeImg");
const pokeName     = document.querySelector("#pokeName");
const pokeInfo     = document.querySelector("#pokeInfo");
const pokeStats    = document.querySelector("#pokeStats");
const pokeCry      = document.querySelector("#pokeCry");
const typeBadges   = document.querySelector("#typeBadges");
const rankBadge    = document.querySelector("#rankBadge");
const historyList  = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const rankBanner   = document.querySelector("#rankBanner");
const rankBannerText = document.querySelector("#rankBannerText");
const fxCanvas     = document.querySelector("#fxCanvas");
const ctx          = fxCanvas.getContext("2d");

// 모달
const modalOverlay   = document.querySelector("#modalOverlay");
const modal          = document.querySelector("#modal");
const modalClose     = document.querySelector("#modalClose");
const modalImg       = document.querySelector("#modalImg");
const modalName      = document.querySelector("#modalName");
const modalInfo      = document.querySelector("#modalInfo");
const modalStats     = document.querySelector("#modalStats");
const modalCry       = document.querySelector("#modalCry");
const modalTypeBadges= document.querySelector("#modalTypeBadges");
const modalRankBadge = document.querySelector("#modalRankBadge");

// ══════════════════════════════════════════════
// 상태
// ══════════════════════════════════════════════
const MAX_POKEMON = 1025;
let   historyData  = [];   // { data, rarity } 배열 (기록용)
let   particles    = [];   // 파티클 배열

const statLabels = {
  hp:"HP", attack:"공격", defense:"방어",
  "special-attack":"특공", "special-defense":"특방", speed:"스피드",
};

// ══════════════════════════════════════════════
// 이벤트
// ══════════════════════════════════════════════
gachaBtn.addEventListener("click", onGachaClick);
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

// ══════════════════════════════════════════════
// 가챠 핸들러
// ══════════════════════════════════════════════
async function onGachaClick() {
  setLoading(true);

  // 초기화
  resultCard.classList.add("hidden");
  pokeballWrap.style.display = "flex";
  pokeball.classList.remove("shaking","shaking-intense","opening","rank-rare","rank-epic","rank-legendary");
  gachaBox.classList.remove("rank-rare","rank-epic","rank-legendary");

  // 포켓볼 흔들기 & API 동시 실행
  const randomId = getRandomId();
  console.log("뽑힌 번호:", randomId);

  try {
    const [pokeData] = await Promise.all([
      getPokeData(randomId),
      shake(),          // 기본 흔들기
    ]);

    const rarity = getRarity(pokeData);
    console.log("희귀도:", rarity);

    // 등급별 추가 흔들기
    if (rarity === "legendary" || rarity === "epic") {
      pokeball.classList.add("rank-" + rarity);
      await shakeIntense();
    }

    // 포켓볼 열기
    await openBall();

    // 결과 그리기
    drawResult(pokeData, rarity);

    // 등급 연출
    triggerRankEffect(rarity);

    // 기록 추가
    addHistory(pokeData, rarity);

  } catch (err) {
    console.error("API 오류:", err);
    alert("포켓몬 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    pokeballWrap.style.display = "flex";
    resultCard.classList.add("hidden");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════
// API
// ══════════════════════════════════════════════
async function getPokeData(idOrName) {
  const res  = await axios.get(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
  const data = res.data;
  const res2 = await axios.get(data.species.url);
  const koName = res2.data.names.find(i => i.language.name === "ko")?.name ?? data.name;
  data.koName = koName;
  return data;
}

function getRandomId() {
  return Math.floor(Math.random() * MAX_POKEMON) + 1;
}

// ══════════════════════════════════════════════
// 결과 그리기 (공통 → 메인/모달 모두 사용)
// ══════════════════════════════════════════════
function fillCardDOM(els, data, rarity) {
  const { rankBadgeEl, typeBadgesEl, imgEl, nameEl, infoEl, statsEl, cryEl, cardEl } = els;

  // 등급 배지
  rankBadgeEl.textContent = RANK_LABEL[rarity];
  rankBadgeEl.className   = `rank-badge rank-${rarity}`;

  // 타입
  typeBadgesEl.innerHTML = data.types.map(t => {
    const n = t.type.name;
    return `<span class="type-badge type-${n}">${translateType(n)}</span>`;
  }).join("");

  // 이미지
  const imgSrc = data.sprites.other?.["official-artwork"]?.front_default
               || data.sprites.front_default;
  imgEl.src = imgSrc;
  imgEl.alt = data.koName;

  // 이름 / 정보
  nameEl.textContent = data.koName;
  infoEl.textContent = `No.${String(data.id).padStart(3,"0")}  ·  ${data.name}  ·  키 ${data.height/10}m  ·  몸무게 ${data.weight/10}kg`;

  // 스탯 바
  statsEl.innerHTML = data.stats.map(s => {
    const label = statLabels[s.stat.name] ?? s.stat.name;
    const val   = s.base_stat;
    const pct   = Math.min((val/255)*100, 100).toFixed(1);
    return `<div class="stat-row">
      <span class="stat-label">${label}</span>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:0%" data-pct="${pct}"></div></div>
      <span class="stat-val">${val}</span>
    </div>`;
  }).join("");

  // 울음소리
  cryEl.src = data.cries?.latest ?? "";

  // 카드 등급 클래스
  cardEl.className = cardEl.className.replace(/\s*rank-\w+/g, "");
  if (rarity !== "normal") cardEl.classList.add(`rank-${rarity}`);

  // 스탯 바 애니메이션
  requestAnimationFrame(() => {
    cardEl.querySelectorAll(".stat-bar").forEach(bar => {
      bar.style.width = bar.dataset.pct + "%";
    });
  });
}

function drawResult(data, rarity) {
  fillCardDOM({
    rankBadgeEl:  rankBadge,
    typeBadgesEl: typeBadges,
    imgEl:        pokeImg,
    nameEl:       pokeName,
    infoEl:       pokeInfo,
    statsEl:      pokeStats,
    cryEl:        pokeCry,
    cardEl:       resultCard,
  }, data, rarity);

  pokeballWrap.style.display = "none";
  resultCard.classList.remove("hidden");

  // 가챠 박스 테두리 등급 색
  if (rarity !== "normal") gachaBox.classList.add(`rank-${rarity}`);
}

// ══════════════════════════════════════════════
// 기록
// ══════════════════════════════════════════════
function addHistory(data, rarity) {
  historyData.unshift({ data, rarity });

  const emptyMsg = historyList.querySelector(".empty-msg");
  if (emptyMsg) emptyMsg.remove();

  const item = document.createElement("div");
  item.className = `history-item rank-${rarity}`;
  item.innerHTML = `
    <img src="${data.sprites.front_default}" alt="${data.koName}" />
    <div>
      <div class="h-name">${data.koName}</div>
      <div class="h-no">No.${String(data.id).padStart(3,"0")}</div>
      <span class="h-rank rank-${rarity}">${RANK_LABEL[rarity]}</span>
    </div>`;

  // 클릭 → 모달
  const idx = historyData.length - 1; // unshift 했으니 0번째
  item.addEventListener("click", () => openModal(historyData[0]));
  // 실제로는 클로저로 해당 인덱스 바인딩
  item._historyIdx = 0;
  item.addEventListener("click", () => openModal({ data, rarity }));

  historyList.prepend(item);
  historyCount.textContent = `(${historyData.length})`;
}

// ── 모달 열기 ────────────────────────────────
function openModal({ data, rarity }) {
  fillCardDOM({
    rankBadgeEl:  modalRankBadge,
    typeBadgesEl: modalTypeBadges,
    imgEl:        modalImg,
    nameEl:       modalName,
    infoEl:       modalInfo,
    statsEl:      modalStats,
    cryEl:        modalCry,
    cardEl:       modal,
  }, data, rarity);

  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalCry.pause();
}

// ══════════════════════════════════════════════
// 등급 연출
// ══════════════════════════════════════════════
function triggerRankEffect(rarity) {
  if (rarity === "normal") return;

  // 배너
  showBanner(rarity);

  if (rarity === "rare")      spawnParticles(30, "star",     ["#3b82f6","#93c5fd","#dbeafe"]);
  if (rarity === "epic")      spawnParticles(60, "star",     ["#a855f7","#d8b4fe","#e879f9","#fff"]);
  if (rarity === "legendary") {
    flashScreen();
    spawnParticles(120, "confetti", ["#f59e0b","#fcd34d","#fef3c7","#ef4444","#ec4899","#fff"]);
  }
}

function showBanner(rarity) {
  const msgs = {
    rare:      "⭐ RARE 포켓몬 등장!",
    epic:      "💎 EPIC 포켓몬!",
    legendary: "✨ LEGENDARY 전설의 포켓몬!!",
  };
  rankBanner.textContent = msgs[rarity];
  rankBanner.className   = `rank-banner rank-${rarity}`;
  rankBanner.classList.add("show");
  setTimeout(() => {
    rankBanner.classList.remove("show");
    setTimeout(() => rankBanner.classList.add("hidden"), 400);
  }, 2800);
}

function flashScreen() {
  document.body.style.transition = "background 0.1s";
  document.body.style.background = "#fffbeb";
  setTimeout(() => { document.body.style.background = "#f3f4f8"; }, 200);
}

// ══════════════════════════════════════════════
// 파티클 시스템
// ══════════════════════════════════════════════
function resizeCanvas() {
  fxCanvas.width  = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function spawnParticles(count, type, colors) {
  for (let i = 0; i < count; i++) {
    particles.push({
      type,
      x: Math.random() * fxCanvas.width,
      y: -10 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      size: type === "confetti" ? 8 + Math.random() * 8 : 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      life: 1,
    });
  }
  if (!animRunning) requestAnimationFrame(animLoop);
}

let animRunning = false;
function animLoop() {
  if (particles.length === 0) { animRunning = false; ctx.clearRect(0,0,fxCanvas.width,fxCanvas.height); return; }
  animRunning = true;
  ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

  particles = particles.filter(p => p.alpha > 0.01 && p.y < fxCanvas.height + 40);

  for (const p of particles) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.12;          // 중력
    p.vx *= 0.99;
    p.rotation += p.rotSpeed;
    p.life  -= 0.012;
    p.alpha  = Math.max(0, p.life);

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);

    if (p.type === "star") {
      drawStar(ctx, 0, 0, p.size, p.color);
    } else {
      // confetti: 직사각형
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
  }
  requestAnimationFrame(animLoop);
}

function drawStar(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const a2 = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
    i === 0
      ? ctx.moveTo(x + r * Math.cos(a1), y + r * Math.sin(a1))
      : ctx.lineTo(x + r * Math.cos(a1), y + r * Math.sin(a1));
    ctx.lineTo(x + (r/2) * Math.cos(a2), y + (r/2) * Math.sin(a2));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ══════════════════════════════════════════════
// 애니메이션 헬퍼
// ══════════════════════════════════════════════
function shake() {
  return new Promise(resolve => {
    pokeball.classList.add("shaking");
    setTimeout(() => { pokeball.classList.remove("shaking"); resolve(); }, 1850);
  });
}

function shakeIntense() {
  return new Promise(resolve => {
    pokeball.classList.add("shaking-intense");
    setTimeout(() => { pokeball.classList.remove("shaking-intense"); resolve(); }, 2100);
  });
}

function openBall() {
  return new Promise(resolve => {
    pokeball.classList.add("opening");
    setTimeout(resolve, 500);
  });
}

// ══════════════════════════════════════════════
// UI 상태
// ══════════════════════════════════════════════
function setLoading(isLoading) {
  gachaBtn.disabled  = isLoading;
  btnText.textContent = isLoading ? "뽑는 중..." : "뽑기!";
}

// ══════════════════════════════════════════════
// 타입 번역
// ══════════════════════════════════════════════
function translateType(en) {
  const map = {
    normal:"노말", fire:"불꽃", water:"물", grass:"풀",
    electric:"전기", ice:"얼음", fighting:"격투", poison:"독",
    ground:"땅", flying:"비행", psychic:"에스퍼", bug:"벌레",
    rock:"바위", ghost:"고스트", dragon:"드래곤", dark:"악",
    steel:"강철", fairy:"페어리",
  };
  return map[en] ?? en;
}