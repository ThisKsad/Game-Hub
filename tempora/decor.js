/* Tempora – Jahreszeiten-Hintergründe für das Spielfeld (1280 × 720).
   side(season): Randstreifen, gezeichnet für die linke Seite (x 0–150); rechts wird gespiegelt.
   frame(season): Verzierung oben und in den unteren Ecken des mittleren Bereichs. */
(function (root) {
  'use strict';
  const COLOR = { spring: '#5C8A3A', summer: '#B8861E', autumn: '#A8501E', winter: '#3F6E99' };

  function leaf(x, y, c, r, s) { s = s || 1; return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (13 * s) + '" ry="' + (6 * s) + '" fill="' + c + '" transform="rotate(' + r + ' ' + x + ' ' + y + ')"/>'; }
  function blossom(x, y, c, s) {
    s = s || 1; const r = 4.5 * s;
    return '<g transform="translate(' + x + ' ' + y + ')"><circle cy="' + (-5 * s) + '" r="' + r + '" fill="' + c + '"/><circle cx="' + (5 * s) + '" cy="' + (-1.5 * s) + '" r="' + r + '" fill="' + c + '"/><circle cx="' + (3 * s) + '" cy="' + (4 * s) + '" r="' + r + '" fill="' + c + '"/><circle cx="' + (-3 * s) + '" cy="' + (4 * s) + '" r="' + r + '" fill="' + c + '"/><circle cx="' + (-5 * s) + '" cy="' + (-1.5 * s) + '" r="' + r + '" fill="' + c + '"/><circle r="' + (2.2 * s) + '" fill="#E2B33C"/></g>';
  }
  function flake(x, y, s, c) {
    s = s || 1; c = c || '#E8F1F8'; const a = 11 * s, b = 8 * s;
    return '<path d="M' + x + ' ' + (y - a) + ' L' + x + ' ' + (y + a) + ' M' + (x - a) + ' ' + y + ' L' + (x + a) + ' ' + y + ' M' + (x - b) + ' ' + (y - b) + ' L' + (x + b) + ' ' + (y + b) + ' M' + (x + b) + ' ' + (y - b) + ' L' + (x - b) + ' ' + (y + b) + '" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
  }
  function pine(x, base, h, c) {
    return '<path d="M' + (x - h * 0.28) + ' ' + base + ' L' + x + ' ' + (base - h) + ' L' + (x + h * 0.28) + ' ' + base + ' Z" fill="' + (c || '#2F5A4A') + '"/><path d="M' + x + ' ' + (base - h) + ' L' + (x - h * 0.11) + ' ' + (base - h * 0.62) + ' Q' + x + ' ' + (base - h * 0.7) + ' ' + (x + h * 0.11) + ' ' + (base - h * 0.62) + ' Z" fill="#F4F8FB"/>';
  }
  function sunflower(x, y, r, stemTo, petal) {
    return '<path d="M' + x + ' 720 L' + x + ' ' + (y + r) + '" stroke="#4E7A3C" stroke-width="5" stroke-linecap="round"/><path d="M' + x + ' ' + (stemTo) + ' Q' + (x - 16) + ' ' + (stemTo - 10) + ' ' + (x - 18) + ' ' + (stemTo - 24) + ' Q' + (x - 4) + ' ' + (stemTo - 20) + ' ' + x + ' ' + (stemTo - 8) + ' Z" fill="#6E9A4E"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + (petal || '#F2C94C') + '" stroke-width="10" stroke-dasharray="5 3"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.55) + '" fill="#5A3A1A"/>';
  }
  function butterfly(x, y, c1, c2, rot) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || -15) + ')"><ellipse cx="-7" cy="-5" rx="8" ry="6" fill="' + c1 + '"/><ellipse cx="7" cy="-5" rx="8" ry="6" fill="' + c1 + '"/><ellipse cx="-5" cy="5" rx="5" ry="4" fill="' + c2 + '"/><ellipse cx="5" cy="5" rx="5" ry="4" fill="' + c2 + '"/><rect x="-1" y="-8" width="2" height="16" rx="1" fill="#2A2926"/></g>';
  }
  function bird(x, y, s) { s = s || 1; return '<path d="M' + (x - 10 * s) + ' ' + y + ' Q' + (x - 5 * s) + ' ' + (y - 6 * s) + ' ' + x + ' ' + y + ' Q' + (x + 5 * s) + ' ' + (y - 6 * s) + ' ' + (x + 10 * s) + ' ' + y + '" stroke="#2F3A4A" stroke-width="2.2" fill="none" stroke-linecap="round"/>'; }
  function tulip(x, top, c) {
    return '<path d="M' + x + ' 720 L' + x + ' ' + (top + 14) + '" stroke="#4E7A3C" stroke-width="4" stroke-linecap="round"/><path d="M' + x + ' ' + (top + 40) + ' Q' + (x + 16) + ' ' + (top + 30) + ' ' + (x + 18) + ' ' + (top + 16) + ' Q' + (x + 4) + ' ' + (top + 22) + ' ' + x + ' ' + (top + 34) + ' Z" fill="#6E9A4E"/><path d="M' + (x - 10) + ' ' + top + ' L' + (x - 5) + ' ' + (top + 8) + ' L' + x + ' ' + (top - 2) + ' L' + (x + 5) + ' ' + (top + 8) + ' L' + (x + 10) + ' ' + top + ' L' + (x + 9) + ' ' + (top + 14) + ' Q' + x + ' ' + (top + 22) + ' ' + (x - 9) + ' ' + (top + 14) + ' Z" fill="' + c + '"/>';
  }
  function bee(x, y) {
    return '<g transform="translate(' + x + ' ' + y + ')"><ellipse cx="-4" cy="-8" rx="6" ry="4" fill="#E3EEF5" opacity="0.9"/><ellipse cx="4" cy="-9" rx="6" ry="4" fill="#E3EEF5" opacity="0.9"/><ellipse rx="10" ry="7" fill="#E2B33C" stroke="#2A2926" stroke-width="1.2"/><path d="M-3 -6.5 L-3 6.5 M3 -6.5 L3 6.5" stroke="#2A2926" stroke-width="3"/><circle cx="-11" cy="0" r="4" fill="#2A2926"/></g>';
  }
  function mushroom(x, c) {
    return '<path d="M' + (x - 6) + ' 720 L' + (x - 4) + ' 696 L' + (x + 4) + ' 696 L' + (x + 6) + ' 720 Z" fill="#E9D9B8"/><path d="M' + (x - 18) + ' 698 Q' + x + ' 674 ' + (x + 18) + ' 698 Z" fill="' + (c || '#B83A2E') + '"/><circle cx="' + (x - 6) + '" cy="690" r="2.5" fill="#FFFFFF"/><circle cx="' + (x + 6) + '" cy="692" r="2" fill="#FFFFFF"/>';
  }

  /* Randstreifen (links gezeichnet) */
  const SIDE = {
    spring:
      '<path d="M0 30 Q50 40 90 20 Q120 8 150 14" stroke="#5B4636" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      blossom(30, 34, '#F4B6C8') + blossom(70, 30, '#F7C9D6') + blossom(110, 16, '#F4B6C8') + blossom(140, 18, '#F7C9D6', 0.8) +
      bird(70, 120) + bird(100, 140, 0.8) + bee(110, 240) +
      tulip(30, 610, '#E85D75') + tulip(75, 640, '#F2C94C') + tulip(120, 600, '#B76CC9') +
      '<ellipse cx="75" cy="716" rx="90" ry="14" fill="#6E9A4E"/>',
    summer:
      '<path d="M40 2 L40 -6 M40 82 L40 90 M2 42 L-6 42 M78 42 L86 42 M13 15 L7 9 M67 69 L73 75 M67 15 L73 9 M13 69 L7 75" stroke="#F2C94C" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="40" cy="42" r="27" fill="#F2C94C"/><circle cx="40" cy="42" r="20" fill="#F6D66B"/>' +
      sunflower(32, 604, 17, 660) + sunflower(76, 634, 14, 680, '#F4A340') + sunflower(122, 590, 16, 650) +
      butterfly(112, 196, '#F4A340', '#E07A2E'),
    autumn:
      '<path d="M0 26 Q60 40 150 20" stroke="#4A3020" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      leaf(30, 34, '#E2A13A', 25) + leaf(80, 36, '#C9572A', -15) + leaf(126, 22, '#B83A2E', 30) +
      leaf(60, 150, '#D98A2E', 40, 0.75) + leaf(110, 300, '#C9572A', -30, 0.75) + leaf(40, 440, '#E2A13A', 15, 0.75) +
      mushroom(40) + mushroom(96, '#C9572A') +
      '<ellipse cx="70" cy="718" rx="90" ry="10" fill="#6B4A2E"/>',
    winter:
      '<path d="M0 0 L150 0 L150 8 L140 20 L130 8 L120 36 L110 8 L100 24 L90 8 L80 44 L70 8 L60 26 L50 8 L40 34 L30 8 L20 22 L10 8 L4 30 L0 8 Z" fill="#E8F1F8" stroke="#A2BCD6" stroke-width="1.5" stroke-linejoin="round"/>' +
      flake(90, 140) + flake(30, 260, 0.8) + flake(110, 380, 0.7) + flake(34, 480) +
      pine(110, 720, 120) + pine(40, 720, 130, '#284E40') +
      '<path d="M0 702 Q80 690 160 720 L0 720 Z" fill="#F4F8FB"/>'
  };

  /* Oberer Rand und untere Ecken des mittleren Bereichs (x 150–1130) */
  const FRAME = {
    spring:
      '<path d="M150 0 Q260 36 420 22 Q480 16 540 4" stroke="#5B4636" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<path d="M1130 0 Q1010 34 870 22 Q810 16 760 4" stroke="#5B4636" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      blossom(210, 26, '#F4B6C8') + blossom(270, 36, '#F7C9D6') + blossom(350, 30, '#F4B6C8') + blossom(440, 22, '#F7C9D6') + blossom(510, 10, '#F4B6C8', 0.8) +
      blossom(1070, 28, '#F7C9D6') + blossom(1000, 34, '#F4B6C8') + blossom(920, 28, '#F7C9D6') + blossom(830, 18, '#F4B6C8', 0.8) +
      bird(620, 60) + bird(650, 46, 0.8) + bird(690, 66, 0.9) +
      tulip(200, 650, '#E85D75') + tulip(240, 664, '#F2C94C') + tulip(280, 656, '#E85D75') +
      tulip(1000, 656, '#B76CC9') + tulip(1040, 646, '#E85D75') + tulip(1080, 662, '#F2C94C') +
      '<ellipse cx="240" cy="718" rx="110" ry="12" fill="#6E9A4E"/><ellipse cx="1040" cy="718" rx="110" ry="12" fill="#6E9A4E"/>',
    summer:
      '<path d="M150 0 L1130 0 L1130 6 Q640 30 150 6 Z" fill="#F2C94C" opacity="0.35"/>' +
      butterfly(330, 60, '#F2C94C', '#E07A2E', 10) + butterfly(960, 70, '#E8A3C0', '#B76CC9', -20) + bird(640, 46) + bird(672, 34, 0.8) +
      '<path d="M170 720 L176 670 M186 720 L194 664 M202 720 L206 676 M218 720 L228 668 M236 720 L240 680 M252 720 L262 670 M270 720 L274 682" stroke="#D9B44A" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="214" cy="676" r="6" fill="#C9372E"/><circle cx="258" cy="682" r="5" fill="#C9372E"/>' +
      '<path d="M1010 720 L1016 668 M1026 720 L1034 662 M1042 720 L1046 674 M1058 720 L1068 666 M1076 720 L1080 678 M1092 720 L1102 668 M1110 720 L1114 680" stroke="#D9B44A" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="1048" cy="670" r="6" fill="#C9372E"/><circle cx="1098" cy="676" r="5" fill="#C9372E"/>',
    autumn:
      '<path d="M150 0 Q260 34 400 26 Q470 22 540 6" stroke="#4A3020" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M300 30 Q320 52 340 58 M440 22 Q452 44 470 50" stroke="#4A3020" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M1130 0 Q1010 30 880 20 Q820 16 760 4" stroke="#4A3020" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M980 26 Q964 48 944 54" stroke="#4A3020" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      leaf(200, 20, '#E2A13A', 25) + leaf(250, 34, '#C9572A', -20) + leaf(340, 60, '#B83A2E', 40, 0.95) + leaf(372, 36, '#E2A13A', 10) +
      leaf(470, 52, '#D98A2E', -35, 0.95) + leaf(510, 20, '#C9572A', 20, 0.9) + leaf(1080, 22, '#C9572A', -25) + leaf(1020, 34, '#E2A13A', 15) +
      leaf(944, 56, '#B83A2E', -40, 0.95) + leaf(900, 28, '#D98A2E', 30) + leaf(800, 16, '#E2A13A', -15, 0.9) +
      leaf(420, 92, '#E2A13A', 50, 0.7) + leaf(610, 74, '#C9572A', -30, 0.7) + leaf(860, 88, '#D98A2E', 20, 0.7) +
      '<path d="M410 18 Q414 6 426 4 Q434 2 440 8 L448 7 L441 11 Q440 20 430 23 Q420 25 410 18 Z" fill="#1E1E20"/><path d="M412 18 L400 22 L412 21 Z" fill="#1E1E20"/><circle cx="436" cy="8" r="1.2" fill="#E2BE5E"/>' +
      '<ellipse cx="214" cy="702" rx="22" ry="16" fill="#D9741E" stroke="#8A4210" stroke-width="2"/><path d="M204 688 Q200 702 204 716 M224 688 Q228 702 224 716" stroke="#8A4210" stroke-width="2" fill="none"/><path d="M214 686 L216 676" stroke="#4E3A27" stroke-width="3" stroke-linecap="round"/>' +
      mushroom(262) +
      '<path d="M1030 720 Q1032 690 1060 688 Q1090 690 1092 720 Z" fill="#6B4A2E"/><path d="M1036 700 L1030 692 M1044 694 L1040 684 M1054 690 L1052 680 M1064 690 L1066 680 M1074 694 L1078 684 M1084 702 L1090 694" stroke="#3E2A1A" stroke-width="3" stroke-linecap="round"/><circle cx="1094" cy="712" r="2.5" fill="#2A2926"/>',
    winter:
      '<path d="M150 0 L1130 0 L1130 6 L1120 18 L1110 6 L1096 28 L1082 6 L1066 16 L1050 6 L1030 34 L1010 6 L990 20 L970 6 L940 26 L910 6 L880 14 L850 6 L420 6 L400 22 L380 6 L350 30 L320 6 L300 16 L280 6 L250 26 L220 6 L200 18 L180 6 L160 24 L150 6 Z" fill="#E8F1F8" stroke="#A2BCD6" stroke-width="1.5" stroke-linejoin="round"/>' +
      flake(520, 60, 0.8) + flake(760, 50, 0.9) + flake(640, 86, 0.6) +
      pine(200, 720, 90) + pine(250, 720, 70, '#284E40') + pine(1080, 720, 95, '#284E40') + pine(1030, 720, 70) +
      '<path d="M150 704 Q230 690 320 720 L150 720 Z" fill="#F4F8FB"/><path d="M960 720 Q1050 688 1130 702 L1130 720 Z" fill="#F4F8FB"/>' +
      '<g transform="translate(300 700)"><path d="M0 0 Q10 -18 30 -14 L38 -24 L40 -12 Q46 -6 40 0 Z" fill="#D9741E"/><path d="M0 0 Q-16 -4 -22 -14 Q-10 -10 2 -6 Z" fill="#D9741E"/><path d="M-22 -14 L-26 -18" stroke="#F4F8FB" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="-14" r="1.4" fill="#2A2926"/></g>'
  };

  function bg(season) { return COLOR[season] || '#555'; }
  function svg(prev, cur, next) {
    return '<svg class="decor" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true">' +
      '<g>' + (SIDE[prev] || '') + '</g>' +
      '<g transform="translate(1280 0) scale(-1 1)">' + (SIDE[next] || '') + '</g>' +
      '<g>' + (FRAME[cur] || '') + '</g></svg>';
  }
  function background(prev, cur, next) {
    return 'radial-gradient(ellipse 58% 52% at 50% 50%, rgba(30,27,24,0.72) 0%, rgba(30,27,24,0.5) 55%, rgba(30,27,24,0) 92%), ' +
      'linear-gradient(90deg, ' + bg(prev) + ' 0%, ' + bg(prev) + ' 8%, ' + bg(cur) + ' 16%, ' + bg(cur) + ' 84%, ' + bg(next) + ' 92%, ' + bg(next) + ' 100%)';
  }

  function mix(a, b) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = function (sh) { return Math.round((((pa >> sh) & 255) + ((pb >> sh) & 255)) / 2); };
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  /* Ein Bild pro Jahreszeit für das laufende Band im Startmenü */
  function panel(prev, cur, next) {
    const l = mix(COLOR[prev], COLOR[cur]), r = mix(COLOR[cur], COLOR[next]);
    return '<div class="bgpanel" style="background:linear-gradient(90deg,' + l + ' 0%,' + COLOR[cur] + ' 14%,' + COLOR[cur] + ' 86%,' + r + ' 100%)">' +
      '<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g>' + SIDE[cur] + '</g><g transform="translate(1280 0) scale(-1 1)">' + SIDE[cur] + '</g><g>' + FRAME[cur] + '</g></svg></div>';
  }
  /* Spielfeld-Hintergrund als laufendes Band: ein Abschnitt (980 px breit) pro Jahreszeit. */
  const SEG = 980, SEG_X = 150;
  function track(seasons, nowIndex) {
    let h = '';
    seasons.forEach(function (cur, i) {
      const prev = seasons[i - 1] || cur, next = seasons[i + 1] || cur;
      const l = mix(COLOR[prev], COLOR[cur]), r = mix(COLOR[cur], COLOR[next]);
      h += '<div class="seg" style="left:' + (SEG_X + (i - nowIndex) * SEG) + 'px;background:linear-gradient(90deg,' + l + ' 0%,' + COLOR[cur] + ' 9%,' + COLOR[cur] + ' 91%,' + r + ' 100%)">' +
        '<svg width="' + SEG + '" height="720" viewBox="150 0 980 720" style="left:2px" aria-hidden="true">' + (FRAME[cur] || '') + '</svg></div>';
    });
    return h;
  }
  root.TEMPORA_DECOR = { svg: svg, background: background, panel: panel, track: track, SEG: SEG, COLOR: COLOR };
})(this);
