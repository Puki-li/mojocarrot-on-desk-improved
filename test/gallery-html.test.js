const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert");

function readGallery() {
  return fs.readFileSync(path.join(__dirname, "..", "gallery.html"), "utf8");
}

describe("gallery idle follow preview", () => {
  it("renders a 9:16 xiaohongshu-style cover collage before the idle section", () => {
    const html = readGallery();

    assert.match(html, /<section id="cover" class="cover-section">[\s\S]*?爆改Clawd桌宠[\s\S]*?给WMLS设计的[\s\S]*?MOJO&nbsp;CARROT[\s\S]*?桌宠[\s\S]*?<\/section>/);
    assert.match(html, /\.cover-line\.lead\s*\{[\s\S]*white-space:\s*nowrap;/);
    assert.match(html, /\.cover-line\.mojo\s*\{[\s\S]*white-space:\s*nowrap;/);
    assert.match(html, /class="cover-art"/);
    assert.match(html, /assets\/svg\/clawd-idle-follow\.svg/);
    assert.match(html, /assets\/svg\/clawd-working-typing\.svg/);
    assert.match(html, /assets\/svg\/clawd-happy\.svg/);
    assert.match(html, /assets\/svg\/clawd-sleeping\.svg/);
    assert.match(html, /assets\/svg\/clawd-error\.svg/);
    assert.match(html, /\.cover-art\s*\{[\s\S]*aspect-ratio:\s*9\s*\/\s*16;/);
    assert.match(html, /\.cover-sticker[\s\S]*position:\s*absolute;/);
    assert.doesNotMatch(html, /xhs · cover concept/);
    assert.doesNotMatch(html, /把待机、打字、完成一口气塞进一张封面里/);
    assert.doesNotMatch(html, /原始状态|打字状态|完成状态/);
    assert.match(html, /\.cover-title\s*\{[\s\S]*font-size:\s*3\.52rem;/);
    assert.match(html, /\.cover-art\s*\{[\s\S]*padding:\s*16px\s+14px;/);
    assert.match(html, /\.cover-sticker\.idle\s*\{[\s\S]*width:\s*52%;/);
    assert.match(html, /\.cover-sticker\.working\s*\{[\s\S]*width:\s*54%;/);
    assert.match(html, /\.cover-sticker\.happy\s*\{[\s\S]*width:\s*48%;/);
    assert.match(html, /\.cover-sticker\.accent-sm\s*\{[\s\S]*width:\s*34%;/);
    assert.match(html, /\.cover-title\s*\{[\s\S]*z-index:\s*9;/);
    assert.match(html, /\.cover-sticker\.idle\s*\{[\s\S]*top:\s*24%;/);
    assert.match(html, /\.cover-sticker\.working\s*\{[\s\S]*left:\s*-7%;[\s\S]*bottom:\s*11%;/);
    assert.match(html, /\.cover-sticker\.fruits\s*\{[\s\S]*left:\s*2%;[\s\S]*top:\s*40%;/);
    assert.match(html, /\.cover-sticker\.error\s*\{[\s\S]*right:\s*6%;[\s\S]*top:\s*50%;/);
  });

  it("renders the idle follow card with the dedicated demo gif", () => {
    const html = readGallery();

    assert.match(html, /<div class="card-preview"><img src="assets\/gif\/clawd-idle-follow-demo\.gif" alt="idle-follow"><\/div>/);
    assert.doesNotMatch(html, /gallery-idle-follow/);
    assert.doesNotMatch(html, /interactive-follow/);
  });

  it("describes idle as the time when they are not working", () => {
    const html = readGallery();

    assert.match(html, /他们不工作的时候/);
  });

  it("uses consistent '当他……时' section titles across the gallery", () => {
    const html = readGallery();
    const titles = [...html.matchAll(/<h2 class="section-title">([^<]+)<\/h2>/g)].map((match) => match[1]);

    assert.deepStrictEqual(titles, [
      "当他开始摸鱼时...",
      "当他突然认真起来时...",
      "当他有话要说时...",
      "当他困到不行时...",
      "当他缩去角落里时...",
      "当他又被你戳到时...",
    ]);
  });

  it("shows the drag gif in the idle section instead of the reactions section", () => {
    const html = readGallery();
    const idleSection = html.match(/<section id="idle">[\s\S]*?<\/section>/)?.[0] || "";
    const reactionsSection = html.match(/<section id="reactions">[\s\S]*?<\/section>/)?.[0] || "";

    assert.match(idleSection, /assets\/gif\/clawd-react-drag\.gif/);
    assert.doesNotMatch(reactionsSection, /assets\/gif\/clawd-react-drag\.gif/);
  });

  it("uses a more playful daily-life voice with ellipses in section descriptions", () => {
    const html = readGallery();
    const descriptions = [...html.matchAll(/<p class="section-desc">([\s\S]*?)<\/p>/g)].map((match) => match[1]);

    assert.ok(descriptions.every((text) => text.includes("...")));
    assert.match(descriptions[0], /盯鼠标|翻小书|晃一圈/);
    assert.match(descriptions[1], /敲字|搬砖|摇人/);
    assert.match(descriptions[2], /开心|报错|权限/);
  });

  it("uses a tighter 9:16-friendly layout for section capture", () => {
    const html = readGallery();

    assert.match(html, /\.container\s*\{[\s\S]*max-width:\s*430px;/);
    assert.match(html, /\.section-label\s*\{[\s\S]*display:\s*none;/);
    assert.match(html, /\.section-desc\s*\{[\s\S]*font-size:\s*0\.74rem;/);
    assert.match(html, /\.grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*1fr\);/);
    assert.match(html, /\.card\s*\{[\s\S]*position:\s*relative;/);
    assert.match(html, /\.card-preview\s*\{[\s\S]*align-items:\s*flex-start;[\s\S]*padding:\s*2px\s+4px\s+12px;[\s\S]*aspect-ratio:\s*4\s*\/\s*3;/);
    assert.match(html, /\.card-preview img\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*transform:\s*translateY\(-13px\)\s*scale\(1\.08\);/);
    assert.match(html, /\.card-body\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*6px;[\s\S]*right:\s*6px;[\s\S]*bottom:\s*6px;/);
    assert.match(html, /\.card-tag\s*\{[\s\S]*margin-bottom:\s*0;/);
  });

  it("keeps card subtitles short and punchy for social posting", () => {
    const html = readGallery();
    const names = [...html.matchAll(/<div class="card-name">([^<]+)<\/div>/g)].map((match) => match[1]);

    assert.ok(names.every((text) => text.length <= 8));
    assert.ok(names.every((text) => !text.includes("...")));
    assert.ok(names.includes("盯着鼠标"));
    assert.ok(names.includes("认真开工"));
    assert.ok(names.includes("任务完成！"));
    assert.ok(names.includes("权限提醒"));
    assert.ok(names.includes("当被拖拽移动"));
    assert.ok(names.includes("水果们跑过"));
    assert.ok(names.includes("大吃一惊"));
    assert.ok(names.includes("变身青苹果"));
  });

  it("uses the updated drag and poke-reaction copy", () => {
    const html = readGallery();

    assert.match(html, /当被拖拽移动/);
    assert.match(html, /水果们跑过/);
    assert.match(html, /大吃一惊/);
    assert.match(html, /变身青苹果/);
    assert.match(html, /任务完成！/);
    assert.match(html, /权限提醒/);
    assert.match(html, /先瞄你，再乱舞，最后直接变身青苹果/);
  });
});
