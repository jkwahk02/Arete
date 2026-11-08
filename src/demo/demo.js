/* Arete demo: the real pages on a generated sample university, no Supabase.
   Builds every table the pages read (four programs with PLOs and curriculum maps,
   about 200 fictional students with their course history, and for Fall 2026 the
   rubrics, CLOs, checkpoints and ratings as at the end of the term), then answers
   the pages' PostgREST-style requests from memory. Writes stay in this tab only. */
(function () {
  'use strict';
  // ---------- a seeded random source, so every visit shows the same university ----------
  var seed = 20261107;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function gauss() { var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  var ME = { email: 'kjy@taejae.ac.kr', name: 'Jiyoung Kwahk' };
  var ILO_T = ['Critical Thinking', 'Creative Thinking', 'Self-directed Learning', 'Communication & Collaboration', 'Diversity & Empathy', 'Global Harmony & Sustainability'];
  var PROGRAMS = [
    { code: 'DA', name: 'Data Science and Artificial Intelligence', field: 'data and AI' },
    { code: 'IF', name: 'Innovation Foundations', field: 'interdisciplinary inquiry' },
    { code: 'HS', name: 'Humanities and Social Sciences', field: 'the humanities and social sciences' },
    { code: 'NS', name: 'Natural Sciences', field: 'the natural sciences' }];
  var NO_PLO = [{ code: 'BI', name: 'Business Innovation' }];   // a major with no PLOs in Arete yet
  // course, title, year level, curriculum map {PLO number: levels}
  var COURSES = {
    DA: [['DA200', 'Design of AI and Data-driven Services', 2, { 1: 'I', 2: 'IA', 3: 'IA', 4: 'I', 5: 'IA', 6: 'IA' }], ['DA201', 'Computational Thinking and Data Literacy', 2, { 1: 'IA', 2: 'I', 3: 'I', 4: 'IA' }],
      ['DA204', 'Exploring Data Ecosystems', 2, { 1: 'IR', 2: 'IR', 3: 'IR', 4: 'IR', 5: 'I', 6: 'I' }], ['DA321', 'Data Analytics and Visualization', 3, { 1: 'RA', 2: 'RA', 3: 'RA', 4: 'RA', 5: 'R', 6: 'R' }],
      ['DA333', 'Practical Applications of Machine Learning', 3, { 1: 'RA', 2: 'R', 3: 'RA' }], ['DA411', 'Computational Mathematics for Diverse Applications', 4, { 1: 'A', 2: 'A', 3: 'R' }],
      ['DA433', 'Affective Computing and Human-Robot Interaction', 4, { 2: 'A', 4: 'A', 5: 'A', 6: 'R' }], ['DA434', 'Embodied Intelligence: AI in Physical Systems', 4, { 2: 'A', 3: 'R', 6: 'A' }]],
    BI: [['BI200', 'Economics for Business and Policy Decisions', 2], ['BI211', 'Principles of Accounting', 2], ['BI221', 'Introduction to Finance', 2], ['BI241', 'Business Analytics', 3],
      ['BI311', 'Marketing Strategy', 3], ['BI331', 'Organizational Behavior', 3], ['BI411', 'Strategic Management', 4], ['BI431', 'Entrepreneurship Capstone', 4]],
    HS: [['HS200', 'Perspectives on Humans and Society', 2], ['HS211', 'Ethics and Society', 2], ['HS212', 'Research Methods in Social Science', 2], ['HS311', 'Global History II', 3],
      ['HS312', 'Literary and Cultural Connections', 3], ['HS321', 'Domestic Problems and Social Changes', 3], ['HS411', 'Political Philosophy Seminar', 4], ['HS421', 'Humanities Capstone', 4]],
    NS: [['NS200', 'Physics in Modern Society', 2], ['NS211', 'Chemistry of Life', 2], ['NS221', 'Biology Fundamentals', 2], ['NS311', 'Environmental Systems', 3],
      ['NS322', 'Molecular Biology', 3], ['NS331', 'Quantitative Methods in Science', 3], ['NS411', 'Climate Science', 4], ['NS422', 'Systems Biology', 4]] };
  // maps for the other programs: introduced early, assessed (A) on two PLOs per advanced course, every PLO assessed at least twice
  ['HS', 'NS'].forEach(function (pc) {
    COURSES[pc].forEach(function (c, k) {
      var m = {}, y = c[2];
      if (y === 2) { m[(k % 6) + 1] = 'IA'; m[((k + 2) % 6) + 1] = 'I'; m[((k + 4) % 6) + 1] = 'I'; }
      else { var a = (k * 2) % 6, b = (k * 2 + 1) % 6; m[a + 1] = y === 3 ? 'RA' : 'A'; m[b + 1] = y === 3 ? 'RA' : 'A'; m[((k * 2 + 3) % 6) + 1] = 'R'; }
      c[3] = m;
    });
  });
  var IF_COURSES = [['IF101', 'Innovation Foundation I'], ['IF102', 'Innovation Foundation II'], ['IF103', 'Innovation Foundation III'], ['IF104', 'Innovation Foundation IV'], ['IF105', 'Innovation Foundation V'], ['IF106', 'Innovation Foundation VI']];
  // the six first-year IF courses: each term's three courses assess all six IF PLOs between them
  COURSES.IF = IF_COURSES.map(function (c, k) { var m = {}, j = k % 3; m[j + 1] = 'IA'; m[j + 4] = 'IA'; m[((j + 1) % 3) + 1] = 'I'; return [c[0], c[1], 1, m]; });
  var FACULTY = { DA: ['Sora Lim', 'Daniel Novak'], BI: ['Hyun Choi', 'Maria Ortega', 'Kenji Mori'], HS: ['Elena Petrova', 'Joon Han', 'Grace Wu'], NS: ['Tomas Weber', 'Mina Seo', 'Priya Rao'], IF: ['Lucas Grant', 'Yuna Kang'] };
  var femail = function (n) { return n.toLowerCase().replace(/[^a-z]+/g, '.') + '@taejae.ac.kr'; };

  var T = {};   // the tables
  T.outcome_ilos = ILO_T.map(function (t, i) { return { ilo_code: 'ILO' + (i + 1), title: t, sort_order: i + 1 }; });
  T.programs = PROGRAMS.map(function (p) { return { code: p.code, name: p.name }; });
  T.outcome_plos = []; T.outcome_plo_ilo_map = []; T.outcome_curriculum_map = []; T.courses = [];
  var VERB = ['critically evaluate evidence, assumptions and limits in', 'design original solutions to open problems in', 'set their own learning direction and acquire new methods in',
    'communicate findings clearly and lead collaboration in', 'understand diverse perspectives and act with empathy in', 'act responsibly for global and sustainable outcomes in'];
  var ploId = 0, ploOf = {};
  PROGRAMS.forEach(function (p) {
    ILO_T.forEach(function (t, i) {
      ploId++; ploOf[p.code + (i + 1)] = ploId;
      T.outcome_plos.push({ plo_id: ploId, program_code: p.code, plo_code: 'PLO' + (i + 1), title: t, definition: 'Graduates ' + VERB[i] + ' ' + p.field + '.', is_active: true, performance_standard_pct: null });
      T.outcome_plo_ilo_map.push({ plo_id: ploId, ilo_code: 'ILO' + (i + 1) });
    });
    COURSES[p.code].forEach(function (c) {
      T.courses.push({ course_id: c[0], title: c[1] });
      Object.keys(c[3]).forEach(function (n) { T.outcome_curriculum_map.push({ course_base_id: c[0], plo_id: ploOf[p.code + n], levels: c[3][n] }); });
    });
  });
  COURSES.BI.forEach(function (c) { T.courses.push({ course_id: c[0], title: c[1] }); });

  // ---------- students: four cohorts, majors, a few self-designed, and their abilities ----------
  var FIRST = ['Minseo', 'Jiwoo', 'Haeun', 'Seojun', 'Yejin', 'Dohyun', 'Ara', 'Taeyang', 'Sumin', 'Hyunwoo', 'Nari', 'Junho', 'Chaeyoung', 'Woojin', 'Eunbi', 'Siwoo', 'Dana', 'Leo', 'Amira', 'Kai', 'Noah', 'Lina', 'Mateo', 'Sofia', 'Ravi', 'Hana', 'Yuto', 'Elif', 'Omar', 'Mei'];
  var LAST = ['Kang', 'Yoon', 'Shin', 'Baek', 'Jung', 'Hwang', 'Oh', 'Ryu', 'Moon', 'Song', 'Jeon', 'Nam', 'Silva', 'Haddad', 'Tanaka', 'Nguyen', 'Kowalski', 'Mensah', 'Rossi', 'Ali'];
  var used = {};
  function name() { for (;;) { var n = pick(FIRST) + ' ' + pick(LAST); if (!used[n]) { used[n] = 1; return n; } } }
  var pcodes = ['DA', 'DA', 'DA', 'BI', 'BI', 'HS', 'HS', 'NS'];
  var progName = {}; PROGRAMS.concat(NO_PLO).forEach(function (p) { progName[p.code] = p.name; });
  T.students = []; var ability = {}, studentProg = {};
  [2023, 2024, 2025, 2026].forEach(function (cy, ci) {
    for (var i = 1; i <= 50; i++) {
      var id = cy * 1000 + i, m1 = '', m2 = '', mi = '', p1 = null, p2 = null, pm = null;
      if (cy < 2026) {
        var r = rnd();
        if (r < 0.04) { m1 = 'Self-designed'; p1 = 'SELF'; p2 = pick(['DA', 'HS', 'BI']); m2 = progName[p2]; }
        else {
          p1 = pick(pcodes); m1 = progName[p1];
          if (rnd() < 0.45) { do { p2 = pick(pcodes); } while (p2 === p1); m2 = progName[p2]; }
          else if (rnd() < 0.35) { do { pm = pick(pcodes); } while (pm === p1); mi = progName[pm]; }
        }
      }
      var nm = name(), adv = p1 === 'DA' && T.students.filter(function (s) { return s.advisor1_email === ME.email; }).length < 22 ? ME.email : femail(pick(FACULTY[p1 && p1 !== 'SELF' ? p1 : 'IF']));
      T.students.push({ id: id, name_en: nm, email: nm.toLowerCase().replace(' ', '.') + id % 1000 + '@taejae.ac.kr', cohort: 'Cohort ' + (ci + 1) + ' (' + cy + ')', status: 'Enrolled',
        major1: m1, major2: m2, minor: mi, advisor1_email: adv, advisor2_email: null });
      studentProg[id] = { p1: p1, p2: p2, pm: pm, cy: cy };
      var base = gauss() * 0.6; ability[id] = ILO_T.map(function () { return base + gauss() * 0.4; });
    }
  });

  // ---------- course history: IF in year 1, then the majors' courses by year level ----------
  var TERMS = [];   // Fall 2023 .. Fall 2026
  for (var y = 2023; y <= 2026; y++) { TERMS.push({ semester: 'Fall', year: y }); if (y < 2026) TERMS.push({ semester: 'Spring', year: y + 1 }); }
  var termCode = function (t) { return t.semester === 'Fall' ? t.year + '-1' : (t.year - 1) + '-2'; };
  var byLevel = function (pc, lv) { return (COURSES[pc] || []).filter(function (c) { return c[2] === lv; }).map(function (c) { return c[0]; }); };
  T.student_course_history = [];
  T.students.forEach(function (s) {
    var sp = studentProg[s.id], taken = {};
    TERMS.forEach(function (t, ti) {
      var start = TERMS.findIndex(function (x) { return x.semester === 'Fall' && x.year === sp.cy; });
      if (ti < start) return;
      var k = ti - start, yr = Math.floor(k / 2) + 1, fall = t.semester === 'Fall', list = [];
      if (yr === 1) list = fall ? ['IF101', 'IF102', 'IF103'] : ['IF104', 'IF105', 'IF106'];
      else {
        var lv = Math.min(yr, 4), main = sp.p1 === 'SELF' ? pick(['DA', 'HS', 'BI']) : sp.p1;
        var take = function (pc, n, level) { byLevel(pc, level).filter(function (c, j) { return !taken[c] && (j % 2 === (fall ? 0 : 1) || rnd() < 0.25); }).slice(0, n).forEach(function (c) { list.push(c); }); };
        take(main, 2, lv); if (lv > 2) take(main, 1, lv - 1);
        if (sp.p2) take(sp.p2, lv > 2 ? 2 : 1, lv > 2 && rnd() < 0.5 ? lv - 1 : lv);
        if (sp.pm) take(sp.pm, 1, 2);
        if (!sp.p2 && !sp.pm) take(pick(['DA', 'BI', 'HS', 'NS']), 1, 2);
      }
      list.forEach(function (c) {
        if (taken[c]) return; taken[c] = 1;
        var sec = c === 'DA200' && t.year === 2026 && fall ? (s.id % 2 ? '01' : '02') : '01';
        T.student_course_history.push({ student_id: String(s.id), course_id: c, term: termCode(t), section: sec, source: t.year === 2026 && fall ? 'registered' : 'graded' });
      });
    });
  });

  // ---------- Fall 2026 offerings: every course with students; DA200 in two sections ----------
  T.course_offerings = []; var offId = 1000;
  var cur = function (h) { return h.term === '2026-1'; };
  var addOff = function (cid, title, sec, prof, pemail) {
    offId++;
    var o = { offering_id: offId, course_id: sec ? cid + '-' + sec : cid, course_base_id: cid, section: sec, semester: 'Fall', year: 2026, title: sec ? title + (sec === 1 ? ': Service Design Emphasis' : ': AI-Assisted Service Development Emphasis') : title,
      status: 'published', professor_email: pemail, professor: prof };
    T.course_offerings.push(o); return o;
  };
  var mine = { DA200: 1, DA321: 1, DA411: 1 };
  [{ code: 'DA' }, { code: 'BI' }, { code: 'HS' }, { code: 'NS' }].forEach(function (p) {
    COURSES[p.code].forEach(function (c, k) {
      if (!T.student_course_history.some(function (h) { return cur(h) && h.course_id === c[0]; })) return;
      var prof = mine[c[0]] ? ME.name : FACULTY[p.code][k % FACULTY[p.code].length], pe = mine[c[0]] ? ME.email : femail(prof);
      if (c[0] === 'DA200') { addOff(c[0], c[1], 1, prof, pe); addOff(c[0], c[1], 2, prof, pe); } else addOff(c[0], c[1], null, prof, pe);
    });
  });
  IF_COURSES.slice(0, 3).forEach(function (c, k) { addOff(c[0], c[1], null, FACULTY.IF[k % 2], femail(FACULTY.IF[k % 2])); });
  // the class roster view: history rows of this term matched to the offering (and its section)
  T.ergon_v_class_roster = [];
  var stuById = {}; T.students.forEach(function (s) { stuById[s.id] = s; });
  T.course_offerings.forEach(function (o) {
    T.student_course_history.filter(function (h) { return cur(h) && h.course_id === o.course_base_id && (!o.section || h.section === '0' + o.section); }).forEach(function (h) {
      var s = stuById[h.student_id];
      T.ergon_v_class_roster.push({ offering_id: o.offering_id, student_no: Number(h.student_id), name_en: s.name_en, email: s.email, source: 'registered' });
    });
  });

  // ---------- course design: CLOs and their PLO links, rubrics, checkpoints, ratings ----------
  T.outcome_clos = []; T.outcome_clo_plo_map = []; T.outcome_rubrics = []; T.outcome_rubric_criteria = []; T.outcome_criterion_clo_map = [];
  T.course_assessments = []; T.outcome_checkpoints = []; T.outcome_checkpoint_criteria = []; T.outcome_checkpoint_items = []; T.outcome_ratings = [];
  T.outcome_rating_history = []; T.outcome_course_reviews = [];
  var ids = { clo: 0, rub: 0, crit: 0, cp: 0, rate: 0, rev: 0 };
  var DESC = function (what) { return { E: 'Goes beyond the task in ' + what + ', with insight others can build on.', P: 'Meets the expectation for ' + what + ' fully and accurately.',
    D: 'Shows ' + what + ' in part; key elements are missing or unclear.', NI: 'Little evidence of ' + what + ' yet.' }; };
  var CLO_T = ['analyse the course problems and judge the evidence behind each claim', 'design and test an original approach to an open problem', 'plan their own learning and adopt new tools without step-by-step guidance',
    'present results clearly and work effectively in a team', 'take account of different users and perspectives in their work', 'weigh the social and environmental impact of their solutions'];
  var levelOf = function (z) { return z > 1.1 ? 'E' : z > -0.2 ? 'P' : z > -1.45 ? 'D' : 'NI'; };   // NI is rare, about 4%
  var ploBias = { 1: 0.15, 2: -0.35, 3: 0.1, 4: 0.2, 5: 0, 6: -0.1 };   // PLO2 sits below the standard, as a demo talking point
  T.course_offerings.forEach(function (o) {
    var map = T.outcome_curriculum_map.filter(function (m) { return m.course_base_id === o.course_base_id; });
    if (!map.length) return;   // Innovation Foundation courses are on no program map
    var roster = T.ergon_v_class_roster.filter(function (r) { return r.offering_id === o.offering_id; });
    // CLOs: one per PLO the course is mapped to
    var clos = map.map(function (m, i) {
      ids.clo++; var p = T.outcome_plos.find(function (x) { return x.plo_id === m.plo_id; }), n = Number(p.plo_code.slice(3));
      T.outcome_clos.push({ clo_id: ids.clo, offering_id: o.offering_id, sort_order: i + 1, text: 'Students can ' + CLO_T[n - 1] + '.', is_active: true });
      T.outcome_clo_plo_map.push({ clo_id: ids.clo, plo_id: m.plo_id, role: 'primary' });
      return { id: ids.clo, plo: m.plo_id, n: n };
    });
    var methods = [['Project (Team Work)', 60, ['Problem framing', 'Analysis and method', 'Communication of results', 'Collaboration and reflection']], ['Learning Journaling (Individual Work)', 40, ['Goal setting', 'Reflection on learning', 'Next steps']]];
    methods.forEach(function (mt, mi) {
      ids.rub++; var rid = ids.rub;
      T.outcome_rubrics.push({ rubric_id: rid, offering_id: o.offering_id, assessment_item: mt[0], default_scope: mi ? 'individual' : 'team', uses_program_rubric_id: null });
      T.course_assessments.push({ offering_id: o.offering_id, item: mt[0], ratio_pct: mt[1] });
      var crits = mt[2].map(function (nm, ci) {
        ids.crit++; var clo = clos[(ci + mi * 4) % clos.length];   // the two methods together reach every CLO
        T.outcome_rubric_criteria.push({ criterion_id: ids.crit, rubric_id: rid, group_key: null, sort_order: ci + 1, name: nm, points: null, descriptors: DESC(nm.toLowerCase()) });
        T.outcome_criterion_clo_map.push({ criterion_id: ids.crit, clo_id: clo.id });
        return { id: ids.crit, clo: clo };
      });
      var cps = mi ? [['Mid-term journaling check', 'formative', 'progress', '2026-10-30'], ['End-of-term journaling', 'summative', 'progress', '2026-12-11']]
        : [['Project proposal', 'formative', 'own', '2026-09-21'], ['Midterm presentation', 'formative', 'progress', '2026-10-26'], ['Final presentation', 'summative', 'progress', '2026-12-07']];
      cps.forEach(function (k, ki) {
        ids.cp++;
        T.outcome_checkpoints.push({ checkpoint_id: ids.cp, rubric_id: rid, offering_id: o.offering_id, label: k[0], held_from: k[3], held_to: null, kind: k[1], reading: k[2], sort_order: ki + 1, created_at: '2026-09-01T00:00:00Z' });
        var growth = (ki - (cps.length - 1)) * 0.3 + (o.course_base_id.charAt(2) === '4' ? 0.15 : 0) + (o.course_base_id.indexOf('IF') === 0 ? 0.3 : 0);
        roster.forEach(function (r) {
          crits.forEach(function (c) {
            if (rnd() < 0.015) return;   // a missing rating now and then
            var z = ability[r.student_no][c.clo.n - 1] + ploBias[c.clo.n] + growth + 0.35 + gauss() * 0.45;
            ids.rate++; T.outcome_ratings.push({ rating_id: ids.rate, checkpoint_id: ids.cp, criterion_id: c.id, item_id: null, student_no: String(r.student_no), level: rnd() < 0.01 ? 'N/O' : levelOf(z), source: 'import', rated_by: o.professor_email });
          });
        });
      });
    });
    if (o.course_base_id === 'DA321') {
      var pr = T.outcome_rubrics.find(function (x) { return x.offering_id === o.offering_id; });
      [['Peer review of drafts', '2026-11-04'], ['Demo Day rehearsal', '2026-11-16']].forEach(function (k, i) {
        ids.cp++; T.outcome_checkpoints.push({ checkpoint_id: ids.cp, rubric_id: pr.rubric_id, offering_id: o.offering_id, label: k[0], held_from: k[1], held_to: null, kind: 'formative', reading: 'progress', sort_order: 10 + i, created_at: '2026-09-01T00:00:00Z' });
      });
    }
    if (o.professor_email === ME.email && o.course_base_id === 'DA321') {
      ids.rev++; T.outcome_course_reviews.push({ review_id: ids.rev, offering_id: o.offering_id, kind: 'note', target: 'PLO2', note: 'Creative Thinking lags in the midterm presentations; add a design sprint before the final.', status: 'open', created_by: ME.email, created_at: '2026-10-28T09:00:00Z' });
    }
  });

  // ---------- Telos requirement tags, standards of performance ----------
  T.requirement_items = [{ id: 1, parent_id: null, category: 'Innovation Foundation', label: 'Complete the 6 required Innovation Foundation courses', course_filter: { course_ids: IF_COURSES.map(function (c) { return c[0]; }) }, is_remainder: false },
    { id: 2, parent_id: null, category: 'Primary Major', label: 'Complete at least 28 credits in your primary major', course_filter: { program: '$major1' }, is_remainder: false },
    { id: 3, parent_id: null, category: 'Second Major', label: 'Complete your second major', course_filter: { program: '$major2' }, is_remainder: false },
    { id: 4, parent_id: null, category: 'Minor', label: 'Complete your minor', course_filter: { program: '$minor' }, is_remainder: false },
    { id: 5, parent_id: null, category: 'General Electives', label: 'Complete your remaining credits as free general electives', course_filter: {}, is_remainder: true }];
  T.student_requirement_courses = T.student_course_history.map(function (h) {
    var sp = studentProg[h.student_id], pc = h.course_id.slice(0, 2);
    var item = pc === 'IF' ? 1 : pc === sp.p1 ? 2 : pc === sp.p2 ? 3 : pc === sp.pm ? 4 : 5;
    var y = Number(h.term.slice(0, 4)), f = h.term.slice(5) === '1';
    return { student_id: h.student_id, item_id: item, course_id: h.course_id, term: (f ? 'Fall ' : 'Spring ') + (f ? y : y + 1) };
  });
  T.outcome_performance_standards = [
    { standard_id: 1, scope: 'institution', pct: 75, effective_year: 2026, effective_semester: 'Fall', note: 'One standard for every PLO and ILO.', set_by: ME.email, set_at: '2026-10-31T02:00:00Z' },
    { standard_id: 2, scope: 'HS', pct: 70, effective_year: 2026, effective_semester: 'Fall', note: 'Set by the HSS chair for the first measured term.', set_by: femail('Elena Petrova'), set_at: '2026-11-02T05:00:00Z' }];
  T.faculty_profiles = [{ email: ME.email, name_en: ME.name, program: [PROGRAMS[0].name], is_chair: true }];

  // ---------- PostgREST-style reads over the tables ----------
  var REL = { courses: ['course_id', 'course_id', 'one'], outcome_plos: ['plo_id', 'plo_id', 'one'], outcome_checkpoints: ['offering_id', 'offering_id', 'many'], outcome_rubrics: ['offering_id', 'offering_id', 'many'] };
  function splitTop(s) { var out = [], d = 0, b = ''; for (var i = 0; i < s.length; i++) { var ch = s[i]; if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(b); b = ''; } else b += ch; } if (b) out.push(b); return out; }
  function test(v, op) {
    var s = v == null ? null : String(v);
    if (op === 'is.null') return v == null; if (op === 'not.is.null') return v != null;
    var m = /^(not\.)?(eq|neq|in|gt|gte|lt|lte|like|ilike)\.(.*)$/.exec(op); if (!m) return true;
    var neg = !!m[1], f = m[2], a = decodeURIComponent(m[3]), r;
    if (f === 'in') { var list = a.replace(/^\(|\)$/g, '').split(',').map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); r = s != null && list.indexOf(s) >= 0; }
    else if (f === 'eq') r = s === a || (a === 'true' && v === true) || (a === 'false' && v === false);
    else if (f === 'neq') r = s !== a;
    else if (f === 'like' || f === 'ilike') { var re = new RegExp('^' + a.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|%/g, '.*') + '$', f === 'ilike' ? 'i' : ''); r = s != null && re.test(s); }
    else { var x = isNaN(Number(s)) ? s : Number(s), y = isNaN(Number(a)) ? a : Number(a); r = f === 'gt' ? x > y : f === 'gte' ? x >= y : f === 'lt' ? x < y : x <= y; }
    return neg ? !r : r;
  }
  function project(row, sel, filters) {
    if (!sel || sel === '*') return Object.assign({}, row);
    var out = {}, keep = true;
    splitTop(sel).forEach(function (f) {
      var m = /^([a-z_]+)(!inner)?\((.*)\)$/.exec(f.trim());
      if (!m) { out[f.trim()] = row[f.trim()]; return; }
      var rel = REL[m[1]], rows = (T[m[1]] || []).filter(function (x) { return String(x[rel[1]]) === String(row[rel[0]]); });
      Object.keys(filters).forEach(function (k) { if (k.indexOf(m[1] + '.') === 0) { var col = k.slice(m[1].length + 1); rows = rows.filter(function (x) { return test(x[col], filters[k]); }); } });
      if (m[2] && !rows.length) keep = false;
      var sub = rows.map(function (x) { return project(x, m[3], {}); });
      out[m[1]] = rel[2] === 'one' ? (sub[0] || null) : sub;
    });
    return keep ? out : null;
  }
  function read(path) {
    var q = path.indexOf('?'), table = q < 0 ? path : path.slice(0, q), params = {};
    (q < 0 ? '' : path.slice(q + 1)).split('&').forEach(function (p) { if (!p) return; var e = p.indexOf('='); params[decodeURIComponent(p.slice(0, e))] = p.slice(e + 1); });
    var rows = (T[table] || []).slice(), embedded = {};
    Object.keys(params).forEach(function (k) {
      if (k === 'select' || k === 'order' || k === 'limit' || k === 'offset') return;
      if (k.indexOf('.') > 0) { embedded[k] = params[k]; return; }
      rows = rows.filter(function (r) { return test(r[k], params[k]); });
    });
    if (params.order) {
      var ord = params.order.split(',').map(function (o) { var p = o.split('.'); return [p[0], p[1] === 'desc' ? -1 : 1]; });
      rows.sort(function (a, b) { for (var i = 0; i < ord.length; i++) { var x = a[ord[i][0]], y = b[ord[i][0]]; if (x == y) continue; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : -1) * ord[i][1]; } return 0; });
    }
    if (params.limit) rows = rows.slice(0, Number(params.limit));
    return rows.map(function (r) { return project(r, params.select && decodeURIComponent(params.select), embedded); }).filter(Boolean)
      .map(function (r) { return JSON.parse(JSON.stringify(r)); });
  }
  var PK = { outcome_checkpoints: 'checkpoint_id', outcome_course_reviews: 'review_id', outcome_performance_standards: 'standard_id', outcome_checkpoint_items: 'item_id' };
  function insert(table, body) {
    var rows = Array.isArray(body) ? body : [body];
    T[table] = T[table] || [];
    return rows.map(function (r) {
      var row = Object.assign({}, r), pk = PK[table];
      if (pk && row[pk] == null) row[pk] = T[table].reduce(function (m, x) { return Math.max(m, x[pk] || 0); }, 0) + 1;
      if (table === 'outcome_performance_standards') { row.set_by = ME.email; row.set_at = new Date().toISOString(); }
      if (table === 'outcome_checkpoints') { var rb = T.outcome_rubrics.find(function (x) { return x.rubric_id === row.rubric_id; }); if (rb) row.offering_id = rb.offering_id; row.created_at = new Date().toISOString(); }
      T[table].push(row); return JSON.parse(JSON.stringify(row));
    });
  }
  var later = function (v) { return Promise.resolve(v); };

  // ---------- the data layer the pages use, signed in as the demo chair ----------
  var db = window.ARETE_DB;
  db.me = { email: ME.email, name: ME.name, isFaculty: true, isChair: true, program: PROGRAMS.map(function (p) { return p.name; }) };
  db.signedIn = function () { return true; };
  db.restore = function () { return Promise.resolve(); };
  db.signIn = function () { return Promise.resolve(); };
  db.signOut = function () { location.hash = '#home'; };
  db.rest = function (path) { return later(read(path)); };
  db.post = function (table, body) { return later(insert(table, body)); };
  db.patch = function (path, body) {
    var q = path.indexOf('?'), table = path.slice(0, q), hits = read(path);
    return later(T[table].filter(function (r) { return hits.some(function (h) { return Object.keys(h).every(function (k) { return JSON.stringify(h[k]) === JSON.stringify(r[k]); }); }); })
      .map(function (r) { Object.assign(r, body); return JSON.parse(JSON.stringify(r)); }));
  };
  db.rpc = function (fn, args) {
    // the demo user chairs DS&AI and teaches in IF, HSS and NS (read only there)
    if (fn === 'outcome_my_programs') return later(PROGRAMS.map(function (p) { return { code: p.code, name: p.name, is_chair: p.code === 'DA' }; }));
    if (fn === 'outcome_can_set_standard') return later(args.p_scope === 'institution' || args.p_scope === 'DA');
    if (fn === 'outcome_upload_checkpoint') {
      T.outcome_ratings = T.outcome_ratings.filter(function (r) { return r.checkpoint_id !== args.p_checkpoint_id; });
      (args.p_rows || []).forEach(function (r) { ids.rate++; T.outcome_ratings.push({ rating_id: ids.rate, checkpoint_id: args.p_checkpoint_id, criterion_id: r.criterion_id || null, item_id: r.item_id || null, student_no: String(r.student_no), level: r.level, source: args.p_source || 'import', rated_by: ME.email }); });
      return later((args.p_rows || []).length);
    }
    return later(null);
  };
  window.ARETE_DEMO = { tables: T };
})();
