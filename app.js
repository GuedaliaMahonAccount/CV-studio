// ===================================================
// DATA PERSISTENCE (SERVER-SIDE)
// ===================================================

const API_URL = '/api/data';
let allProfiles = {};
let currentProfileId = "";
let data = {};
const FE_LOG_PREFIX = "[CV Studio FE]";
const JSON_MIME_TYPES = new Set(['application/json', 'text/json']);

async function loadFromServer() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    allProfiles = json.allProfiles;
    currentProfileId = json.currentProfileId;
    data = allProfiles[currentProfileId];
    
    // Update UI
    updateVersionSelect();
    syncInputsFromData();
    updateDensityUI();
    render(false); // don't push back immediately
    
    // Build editors
    buildExpEditor();
    buildEduEditor();
    buildSkillsEditor();
    buildProjEditor();
    buildLangEditor();
    buildInterestEditor();
    
    console.log("Data loaded from server");
    
    // First-launch: if no template was ever chosen, show the template picker
    const hasTemplate = data.layout && data.layout.template;
    if (!hasTemplate) {
      showTemplateModal('initial');
    }

    // Initialize Import Modal events
    initImportModal();

  } catch (err) {
    console.error("Error loading from server. Make sure 'npm start' is running.", err);
    // Fallback to local storage if server is down
    loadFromLocalStorage();
  }
}

async function pushToServer() {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentProfileId,
        allProfiles
      })
    });
  } catch (err) {
    console.error("Error saving to server", err);
    saveToLocalStorage(); // fallback
  }
}

// Local Storage Fallback
function saveToLocalStorage() {
  localStorage.setItem('cv_profiles', JSON.stringify(allProfiles));
  localStorage.setItem('cv_current_id', currentProfileId);
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('cv_profiles');
  const savedId = localStorage.getItem('cv_current_id');
  if (saved) {
    allProfiles = JSON.parse(saved);
    currentProfileId = savedId || Object.keys(allProfiles)[0];
    data = allProfiles[currentProfileId];
    updateVersionSelect();
    syncInputsFromData();
    updateDensityUI();
    render(false);
    initImportModal();
  }
}

// ===================================================
// VERSION MANAGEMENT
// ===================================================

function updateVersionSelect() {
  const select = document.getElementById("version-select");
  if (!select) return;
  select.innerHTML = "";
  Object.keys(allProfiles).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    if (id === currentProfileId) opt.selected = true;
    select.appendChild(opt);
  });
}

function switchVersion(id) {
  if (!allProfiles[id]) return;
  currentProfileId = id;
  data = allProfiles[id];
  syncInputsFromData();
  updateDensityUI();
  render();
  buildExpEditor();
  buildEduEditor();
  buildSkillsEditor();
  buildProjEditor();
  buildLangEditor();
  buildInterestEditor();
}

function syncInputsFromData() {
  document.getElementById("h-name").value = data.header.name || "";
  document.getElementById("h-title").value = data.header.title || "";
  document.getElementById("h-summary").value = data.header.summary || "";
  document.getElementById("h-email").value = data.header.email || "";
  document.getElementById("h-phone").value = data.header.phone || "";
  document.getElementById("h-loc").value = data.header.location || "";
  document.getElementById("h-linkedin").value = data.header.linkedin || "";
  document.getElementById("h-github").value = data.header.github || "";
  updatePhotoPreview();
  updateTemplateUI();
}

let pendingNewVersionName = null;

function createNewVersion() {
  const name = prompt("Enter name for the new version:");
  if (!name || allProfiles[name]) {
    if (name) alert("A version with this name already exists!");
    return;
  }
  // Store the name and show template chooser
  pendingNewVersionName = name;
  showTemplateModal('newVersion');
}

function renameVersion() {
  const newName = prompt("Rename version to:", currentProfileId);
  if (!newName || newName === currentProfileId) return;
  if (allProfiles[newName]) {
    alert("A version with this name already exists!");
    return;
  }
  allProfiles[newName] = allProfiles[currentProfileId];
  delete allProfiles[currentProfileId];
  currentProfileId = newName;
  updateVersionSelect();
  pushToServer();
}

function duplicateVersion() {
  const name = prompt("Enter name for duplicate:", currentProfileId + " (Copy)");
  if (!name || allProfiles[name]) {
    if (name) alert("A version with this name already exists!");
    return;
  }
  allProfiles[name] = JSON.parse(JSON.stringify(data));
  currentProfileId = name;
  data = allProfiles[name];
  updateVersionSelect();
  switchVersion(name);
}

function deleteVersion() {
  const keys = Object.keys(allProfiles);
  if (keys.length <= 1) {
    alert("You must have at least one version!");
    return;
  }
  if (!confirm(`Are you sure you want to delete "${currentProfileId}"?`)) return;

  delete allProfiles[currentProfileId];
  currentProfileId = Object.keys(allProfiles)[0];
  data = allProfiles[currentProfileId];
  updateVersionSelect();
  switchVersion(currentProfileId);
}

function resetToDefault() {
  alert("Reset is disabled in Server Mode. To reset, modify data.json directly or delete it to restart.");
}

// ===================================================
// RENDER CV
// ===================================================

const LAYOUT_COLOR_PRESETS = [
  { id: "classic-teal", primary: "#2a8a8a", secondary: "#1e6666" },
  { id: "executive-gold", primary: "#c9a84c", secondary: "#1a2744" },
  { id: "creative-violet", primary: "#7c3aed", secondary: "#5b21b6" },
  { id: "bold-coral", primary: "#e74c3c", secondary: "#c0392b" },
  { id: "minimal-slate", primary: "#555555", secondary: "#333333" }
];
const DEFAULT_COLOR_PRESET = "classic-teal";
const SKILL_PALETTE_BY_PRESET = {
  "classic-teal": ["#1e6666", "#2a8a8a", "#235555", "#3a7a7a", "#2f6f6f"],
  "executive-gold": ["#1a2744", "#273657", "#34456a", "#6f561f", "#8a6b29"],
  "creative-violet": ["#5b21b6", "#6d28d9", "#7c3aed", "#4c1d95", "#6b21a8"],
  "bold-coral": ["#c0392b", "#a93226", "#b53e31", "#e74c3c", "#9f2b22"],
  "minimal-slate": ["#2f2f2f", "#3a3a3a", "#444444", "#505050", "#5b5b5b"]
};

function getSkillPalette() {
  const presetId = getValidColorPresetId(data.layout || {});
  return SKILL_PALETTE_BY_PRESET[presetId] || SKILL_PALETTE_BY_PRESET[DEFAULT_COLOR_PRESET];
}

function skillColor(s) {
  const palette = getSkillPalette();
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function skillTextColor(s) { return "#ffffff"; }
function esc(s) { return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function hasText(v) { return !!(v && v.toString().trim()); }
function ensureHref(url) {
  const raw = (url || "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function ensureLayoutData() {
  if (!data.layout) data.layout = { density: "tight" };
  return data.layout;
}

function getColorPresetById(presetId) {
  return LAYOUT_COLOR_PRESETS.find(preset => preset.id === presetId) || null;
}

function getValidColorPresetId(layout) {
  if (layout && getColorPresetById(layout.colorPreset)) return layout.colorPreset;
  return DEFAULT_COLOR_PRESET;
}

function getResolvedLayoutColors(layout) {
  const presetId = getValidColorPresetId(layout);
  const preset = getColorPresetById(presetId) || LAYOUT_COLOR_PRESETS[0];
  if (layout && layout.colorPreset !== presetId) layout.colorPreset = presetId;
  return {
    presetId,
    primary: preset.primary,
    secondary: preset.secondary
  };
}

function updateColorPaletteUI() {
  const layout = data.layout || {};
  const activePreset = getValidColorPresetId(layout);
  if (layout.colorPreset !== activePreset) layout.colorPreset = activePreset;
  document.querySelectorAll(".color-palette-btn").forEach(btn => {
    const isActive = btn.id === `palette-${activePreset}`;
    btn.classList.toggle("active", isActive);
  });
}

function render(shouldPush = true) {
  syncHeaderFromInputs();
  const h = data.header;
  const layout = data.layout || {};
  const density = layout.density || "tight";
  const fillHeight = layout.fillHeight;
  const template = layout.template || "classic";
  const colors = getResolvedLayoutColors(layout);
  
  const cvDoc = document.getElementById("cv-doc");
  cvDoc.className = `density-${density} ${fillHeight ? 'fill-height' : ''}`;
  cvDoc.setAttribute('data-template', template);
  cvDoc.style.setProperty('--cv-primary', colors.primary);
  cvDoc.style.setProperty('--cv-secondary', colors.secondary);
  
  cvDoc.style.setProperty('--cv-font-size', (layout.fontSize || 13) + 'px');
  cvDoc.style.setProperty('--cv-line-height', layout.lineHeight || 1.1);
  cvDoc.style.setProperty('--cv-name-size', (layout.nameSize || 2.8) + 'rem');
  
  // Choose render method based on template
  if (template === 'creative') {
    renderCreativeTemplate(cvDoc, h);
  } else if (template === 'bold') {
    renderBoldTemplate(cvDoc, h);
  } else {
    renderStandardTemplate(cvDoc, h);
  }
  
  if (shouldPush) pushToServer();
  updatePreviewScale();
  setTimeout(checkOverflow, 50);
}

// Standard layout (Classic, Executive, Minimal)
function renderStandardTemplate(cvDoc, h) {
  cvDoc.innerHTML = `
    <div class="cv-header">
      <div class="cv-header-left">
        <div class="cv-name">${esc(h.name)}</div>
        <div class="cv-title">${esc(h.title)}</div>
        <div class="cv-summary">${esc(h.summary)}</div>
      </div>
      <div class="cv-header-right">
        <div class="cv-contact-item"><span>${esc(h.email)}</span><i class="fas fa-envelope"></i></div>
        <div class="cv-contact-item"><span>${esc(h.phone)}</span><i class="fas fa-phone"></i></div>
        <div class="cv-contact-item"><span>${esc(h.location)}</span><i class="fas fa-map-marker-alt"></i></div>
        ${hasText(h.linkedin) ? `<div class="cv-contact-item"><a href="${esc(ensureHref(h.linkedin))}" target="_blank">LinkedIn</a><i class="fab fa-linkedin"></i></div>` : ""}
        ${hasText(h.github) ? `<div class="cv-contact-item"><a href="${esc(ensureHref(h.github))}" target="_blank">GitHub</a><i class="fab fa-github"></i></div>` : ""}
      </div>
    </div>
    <div class="cv-body">
      <div class="cv-col-left">${renderExperience()}${renderEducation()}</div>
      <div class="cv-col-right">${renderSkills()}${renderProjects()}${renderLanguages()}${renderInterests()}</div>
    </div>`;
}

// Creative template — sidebar with photo, unique layout
function renderCreativeTemplate(cvDoc, h) {
  const photoHtml = h.photo 
    ? `<img class="creative-photo" src="${esc(h.photo)}" alt="Photo" onerror="this.style.display='none'">`
    : `<div class="creative-photo-placeholder"><i class="fas fa-user"></i></div>`;

  cvDoc.innerHTML = `
    <div class="cv-body">
      <div class="cv-creative-sidebar">
        ${photoHtml}
        <div class="creative-name">${esc(h.name)}</div>
        <div class="creative-jobtitle">${esc(h.title)}</div>
        
        <div class="creative-section-title">Contact</div>
        <div>
          <div class="creative-contact-item"><i class="fas fa-envelope"></i> ${esc(h.email)}</div>
          <div class="creative-contact-item"><i class="fas fa-phone"></i> ${esc(h.phone)}</div>
          <div class="creative-contact-item"><i class="fas fa-map-marker-alt"></i> ${esc(h.location)}</div>
          ${hasText(h.linkedin) ? `<div class="creative-contact-item"><i class="fab fa-linkedin"></i> <a href="${esc(ensureHref(h.linkedin))}" target="_blank">LinkedIn</a></div>` : ""}
          ${hasText(h.github) ? `<div class="creative-contact-item"><i class="fab fa-github"></i> <a href="${esc(ensureHref(h.github))}" target="_blank">GitHub</a></div>` : ""}
        </div>
        
        ${data.skills && data.skills.length ? `
          <div class="creative-section-title">Skills</div>
          <div>${data.skills.map(s => `<span class="creative-skill-badge" style="background:${skillColor(s)};color:${skillTextColor(s)}">${esc(s)}</span>`).join('')}</div>
        ` : ''}
        
        ${data.languages && data.languages.length ? `
          <div class="creative-section-title">Languages</div>
          <div>${data.languages.map(l => `<div class="creative-lang-item"><span class="creative-lang-name">${esc(l.name)}</span><span class="creative-lang-level">${esc(l.level)}</span></div>`).join('')}</div>
        ` : ''}
        
        ${data.interests && data.interests.length ? `
          <div class="creative-section-title">Interests</div>
          <div>${data.interests.map(i => `<span class="creative-interest-badge">${esc(i)}</span>`).join('')}</div>
        ` : ''}
      </div>
      <div class="cv-creative-main">
        <div class="creative-summary">${esc(h.summary)}</div>
        ${renderExperience()}
        ${renderEducation()}
        ${renderProjects()}
      </div>
    </div>`;
}

// Bold template — full-width red header with photo
function renderBoldTemplate(cvDoc, h) {
  const photoHtml = h.photo
    ? `<img class="bold-photo" src="${esc(h.photo)}" alt="Photo" onerror="this.style.display='none'">`
    : `<div class="bold-photo-placeholder"><i class="fas fa-user"></i></div>`;

  cvDoc.innerHTML = `
    <div class="cv-bold-header">
      ${photoHtml}
      <div class="bold-info">
        <div class="bold-name">${esc(h.name)}</div>
        <div class="bold-jobtitle">${esc(h.title)}</div>
        <div class="bold-contact-row">
          <div class="bold-contact-item"><i class="fas fa-envelope"></i> ${esc(h.email)}</div>
          <div class="bold-contact-item"><i class="fas fa-phone"></i> ${esc(h.phone)}</div>
          <div class="bold-contact-item"><i class="fas fa-map-marker-alt"></i> ${esc(h.location)}</div>
          ${hasText(h.linkedin) ? `<div class="bold-contact-item"><i class="fab fa-linkedin"></i> <a href="${esc(ensureHref(h.linkedin))}" target="_blank">LinkedIn</a></div>` : ""}
          ${hasText(h.github) ? `<div class="bold-contact-item"><i class="fab fa-github"></i> <a href="${esc(ensureHref(h.github))}" target="_blank">GitHub</a></div>` : ""}
        </div>
      </div>
    </div>
    <div class="bold-summary-bar">${esc(h.summary)}</div>
    <div class="cv-body">
      <div class="cv-col-left">${renderExperience()}${renderEducation()}</div>
      <div class="cv-col-right">${renderSkills()}${renderProjects()}${renderLanguages()}${renderInterests()}</div>
    </div>`;
}

function renderExperience() {
  if (!data.experience || !data.experience.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Work Experience</div>
    ${data.experience.map(e => `<div class="cv-exp-item">
      <div class="cv-exp-head"><div class="cv-exp-title">${esc(e.title)}</div><div class="cv-exp-loc">${esc(e.location)}</div></div>
      <div class="cv-exp-sub"><span class="cv-exp-company">${esc(e.company)}</span><span class="cv-exp-date">${esc(e.dates)}</span></div>
      ${e.description ? `<div class="cv-exp-desc">${esc(e.description)}</div>` : ""}
      ${e.bullets && e.bullets.length ? `<div class="cv-exp-label">Achievements/Tasks</div><ul class="cv-exp-list">${e.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
      ${e.contact ? `<div class="cv-exp-contact"><em>Contact:</em> ${esc(e.contact)}</div>` : ""}</div>`).join("")}</div>`;
}

function renderEducation() {
  if (!data.education || !data.education.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Education</div>
    ${data.education.map(e => `<div class="cv-exp-item">
      <div class="cv-exp-head"><div class="cv-exp-title">${esc(e.degree)}</div><div class="cv-exp-loc">${esc(e.location)}</div></div>
      <div class="cv-exp-sub"><span class="cv-exp-company">${esc(e.institution)}</span><span class="cv-exp-date">${esc(e.dates)}</span></div>
      ${e.details ? `<div class="cv-exp-desc">${esc(e.details)}</div>` : ""}</div>`).join("")}</div>`;
}

function renderSkills() {
  if (!data.skills || !data.skills.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Skills</div>
    <div class="cv-skills-grid">${data.skills.map(s => `<span class="cv-skill-badge" style="background:${skillColor(s)};color:${skillTextColor(s)}">${esc(s)}</span>`).join("")}</div></div>`;
}

function renderProjects() {
  if (!data.projects || !data.projects.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Personal Projects</div>
    ${data.projects.map(p => `<div class="cv-proj-item">
      <div class="cv-proj-head"><span class="cv-proj-name">${esc(p.name)}</span><span class="cv-proj-date">(${esc(p.dates)})</span></div>
      ${p.url ? `<div class="cv-proj-link"><a href="https://${esc(p.url)}" target="_blank">${esc(p.url)}</a></div>` : ""}
      <ul class="cv-proj-list">${p.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}

function renderLanguages() {
  if (!data.languages || !data.languages.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Languages</div>
    <div class="cv-langs-grid">${data.languages.map(l => `<div class="cv-lang-item"><div class="cv-lang-name">${esc(l.name)}</div><div class="cv-lang-level">${esc(l.level)}</div></div>`).join("")}</div></div>`;
}

function renderInterests() {
  if (!data.interests || !data.interests.length) return "";
  return `<div class="cv-section"><div class="cv-section-title">Interests</div>
    <div class="cv-interests-grid">${data.interests.map(i => `<span class="cv-interest-badge">${esc(i)}</span>`).join("")}</div></div>`;
}

// ===================================================
// EDITORS
// ===================================================
function syncHeaderFromInputs() {
  if (!data.header) return;
  data.header.name = document.getElementById("h-name").value;
  data.header.title = document.getElementById("h-title").value;
  data.header.summary = document.getElementById("h-summary").value;
  data.header.email = document.getElementById("h-email").value;
  data.header.phone = document.getElementById("h-phone").value;
  data.header.location = document.getElementById("h-loc").value;
  data.header.linkedin = document.getElementById("h-linkedin").value;
  data.header.github = document.getElementById("h-github").value;
  // photo is set by uploadPhoto/removePhoto, not by input
}

function buildExpEditor() {
  const c = document.getElementById("exp-list"); if (!c) return; c.innerHTML = "";
  data.experience.forEach((e, i) => {
    const card = document.createElement("div"); card.className = "section-card";
    card.innerHTML = `
      <div class="section-card-header" onclick="toggleCard('exp-body-${i}')">
        <div class="section-card-title"><span>${e.title || "Untitled"}</span><span class="num-badge">${i + 1}</span></div>
        <div class="section-card-actions">
          <button class="icon-btn" onclick="event.stopPropagation();moveItem(data.experience,${i},-1)"><i class="fas fa-arrow-up"></i></button>
          <button class="icon-btn" onclick="event.stopPropagation();moveItem(data.experience,${i},1)"><i class="fas fa-arrow-down"></i></button>
          <button class="icon-btn danger" onclick="event.stopPropagation();removeItem(data.experience,${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="section-card-body" id="exp-body-${i}">
        <div class="two-col">
          <div class="field-group"><label class="field-label">Job Title</label><input class="field-input" value="${esc(e.title)}" oninput="data.experience[${i}].title=this.value;render();buildExpEditor()"></div>
          <div class="field-group"><label class="field-label">Company</label><input class="field-input" value="${esc(e.company)}" oninput="data.experience[${i}].company=this.value;render()"></div>
        </div>
        <div class="two-col">
          <div class="field-group"><label class="field-label">Dates</label><input class="field-input" value="${esc(e.dates)}" oninput="data.experience[${i}].dates=this.value;render()"></div>
          <div class="field-group"><label class="field-label">Location</label><input class="field-input" value="${esc(e.location)}" oninput="data.experience[${i}].location=this.value;render()"></div>
        </div>
        <div class="field-group"><label class="field-label">Description (optional)</label><textarea class="field-textarea" oninput="data.experience[${i}].description=this.value;render()">${esc(e.description)}</textarea></div>
        <div class="field-group"><label class="field-label">Bullet Points</label>
          <div class="bullets-list">${e.bullets.map((b, bi) => `<div class="bullet-row"><textarea oninput="data.experience[${i}].bullets[${bi}]=this.value;render()">${esc(b)}</textarea><button class="icon-btn danger" onclick="data.experience[${i}].bullets.splice(${bi},1);render();buildExpEditor()"><i class="fas fa-times"></i></button></div>`).join("")}</div>
          <button class="add-bullet-btn" onclick="data.experience[${i}].bullets.push('');render();buildExpEditor()"><i class="fas fa-plus"></i> Add bullet</button>
        </div>
        <div class="field-group"><label class="field-label">Contact (optional)</label><input class="field-input" value="${esc(e.contact)}" oninput="data.experience[${i}].contact=this.value;render()"></div>
      </div>`;
    c.appendChild(card);
  });
}
function addExp() { data.experience.push({ title: "New Position", company: "", dates: "", location: "", description: "", bullets: [], contact: "" }); render(); buildExpEditor(); }

function buildEduEditor() {
  const c = document.getElementById("edu-list"); if (!c) return; c.innerHTML = "";
  data.education.forEach((e, i) => {
    const card = document.createElement("div"); card.className = "section-card";
    card.innerHTML = `
      <div class="section-card-header" onclick="toggleCard('edu-body-${i}')">
        <div class="section-card-title"><span>${e.degree || "Untitled"}</span></div>
        <div class="section-card-actions"><button class="icon-btn danger" onclick="event.stopPropagation();removeItem(data.education,${i})"><i class="fas fa-trash"></i></button></div>
      </div>
      <div class="section-card-body" id="edu-body-${i}">
        <div class="field-group"><label class="field-label">Degree / Title</label><input class="field-input" value="${esc(e.degree)}" oninput="data.education[${i}].degree=this.value;render();buildEduEditor()"></div>
        <div class="two-col">
          <div class="field-group"><label class="field-label">Institution</label><input class="field-input" value="${esc(e.institution)}" oninput="data.education[${i}].institution=this.value;render()"></div>
          <div class="field-group"><label class="field-label">Dates</label><input class="field-input" value="${esc(e.dates)}" oninput="data.education[${i}].dates=this.value;render()"></div>
        </div>
        <div class="field-group"><label class="field-label">Location</label><input class="field-input" value="${esc(e.location)}" oninput="data.education[${i}].location=this.value;render()"></div>
        <div class="field-group"><label class="field-label">Details (optional)</label><textarea class="field-textarea" oninput="data.education[${i}].details=this.value;render()">${esc(e.details)}</textarea></div>
      </div>`;
    c.appendChild(card);
  });
}
function addEdu() { data.education.push({ degree: "New Degree", institution: "", dates: "", location: "", details: "" }); render(); buildEduEditor(); }

function buildSkillsEditor() {
  const c = document.getElementById("skills-tags"); if (!c) return; c.innerHTML = "";
  data.skills.forEach((s, i) => {
    const tag = document.createElement("div"); tag.className = "skill-tag-edit";
    tag.innerHTML = `<span>${esc(s)}</span><button onclick="data.skills.splice(${i},1);render();buildSkillsEditor()"><i class="fas fa-times"></i></button>`;
    c.appendChild(tag);
  });
}
function addSkill() {
  const inp = document.getElementById("new-skill-input");
  const v = inp.value.trim(); if (!v) return;
  data.skills.push(v); inp.value = ""; render(); buildSkillsEditor();
}

function buildProjEditor() {
  const c = document.getElementById("proj-list"); if (!c) return; c.innerHTML = "";
  data.projects.forEach((p, i) => {
    const card = document.createElement("div"); card.className = "section-card";
    card.innerHTML = `
      <div class="section-card-header" onclick="toggleCard('proj-body-${i}')">
        <div class="section-card-title"><span>${p.name || "Untitled"}</span><span class="num-badge">${i + 1}</span></div>
        <div class="section-card-actions">
          <button class="icon-btn" onclick="event.stopPropagation();moveItem(data.projects,${i},-1)"><i class="fas fa-arrow-up"></i></button>
          <button class="icon-btn" onclick="event.stopPropagation();moveItem(data.projects,${i},1)"><i class="fas fa-arrow-down"></i></button>
          <button class="icon-btn danger" onclick="event.stopPropagation();removeItem(data.projects,${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="section-card-body" id="proj-body-${i}">
        <div class="two-col">
          <div class="field-group"><label class="field-label">Name</label><input class="field-input" value="${esc(p.name)}" oninput="data.projects[${i}].name=this.value;render();buildProjEditor()"></div>
          <div class="field-group"><label class="field-label">Dates</label><input class="field-input" value="${esc(p.dates)}" oninput="data.projects[${i}].dates=this.value;render()"></div>
        </div>
        <div class="field-group"><label class="field-label">URL (optional)</label><input class="field-input" value="${esc(p.url)}" oninput="data.projects[${i}].url=this.value;render()"></div>
        <div class="field-group"><label class="field-label">Bullet Points</label>
          <div class="bullets-list">${p.bullets.map((b, bi) => `<div class="bullet-row"><textarea oninput="data.projects[${i}].bullets[${bi}]=this.value;render()">${esc(b)}</textarea><button class="icon-btn danger" onclick="data.projects[${i}].bullets.splice(${bi},1);render();buildProjEditor()"><i class="fas fa-times"></i></button></div>`).join("")}</div>
          <button class="add-bullet-btn" onclick="data.projects[${i}].bullets.push('');render();buildProjEditor()"><i class="fas fa-plus"></i> Add bullet</button>
        </div>
      </div>`;
    c.appendChild(card);
  });
}
function addProj() { data.projects.push({ name: "New Project", dates: "", url: "", bullets: [] }); render(); buildProjEditor(); }

function buildLangEditor() {
  const c = document.getElementById("lang-list"); if (!c) return; c.innerHTML = "";
  data.languages.forEach((l, i) => {
    const card = document.createElement("div"); card.className = "section-card";
    card.innerHTML = `
      <div class="section-card-header" onclick="toggleCard('lang-body-${i}')">
        <div class="section-card-title"><span>${l.name || "Language"}</span></div>
        <div class="section-card-actions"><button class="icon-btn danger" onclick="event.stopPropagation();removeItem(data.languages,${i})"><i class="fas fa-trash"></i></button></div>
      </div>
      <div class="section-card-body" id="lang-body-${i}">
        <div class="field-group"><label class="field-label">Language</label><input class="field-input" value="${esc(l.name)}" oninput="data.languages[${i}].name=this.value;render();buildLangEditor()"></div>
        <div class="field-group"><label class="field-label">Proficiency Level</label><input class="field-input" value="${esc(l.level)}" oninput="data.languages[${i}].level=this.value;render()"></div>
      </div>`;
    c.appendChild(card);
  });
}
function addLang() { data.languages.push({ name: "New Language", level: "" }); render(); buildLangEditor(); }

function buildInterestEditor() {
  const c = document.getElementById("interest-tags"); if (!c) return; c.innerHTML = "";
  data.interests.forEach((s, i) => {
    const tag = document.createElement("div"); tag.className = "skill-tag-edit";
    tag.innerHTML = `<span>${esc(s)}</span><button onclick="data.interests.splice(${i},1);render();buildInterestEditor()"><i class="fas fa-times"></i></button>`;
    c.appendChild(tag);
  });
}
function addInterest() {
  const inp = document.getElementById("new-interest-input");
  const v = inp.value.trim(); if (!v) return;
  data.interests.push(v); inp.value = ""; render(); buildInterestEditor();
}

// ===================================================
// UTILS
// ===================================================
function toggleCard(id) { const b = document.getElementById(id); if (b) b.classList.toggle("open"); }
function removeItem(arr, idx) { arr.splice(idx, 1); render(); buildExpEditor(); buildEduEditor(); buildProjEditor(); buildLangEditor(); }
function moveItem(arr, idx, dir) {
  const n = idx + dir; if (n < 0 || n >= arr.length) return;
  [arr[idx], arr[n]] = [arr[n], arr[idx]];
  render(); buildExpEditor(); buildEduEditor(); buildProjEditor(); buildLangEditor();
}

function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tnav").forEach(b => b.classList.remove("active"));
  const panel = document.getElementById("tab-" + name); if (panel) panel.classList.add("active");
  const btn = document.querySelector(`.tnav[data-tab="${name}"]`); if (btn) btn.classList.add("active");
}

function saveData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `cv_${currentProfileId.replace(/\s+/g, '_').toLowerCase()}.json`; a.click();
}

function normalizeImportedProfile(loaded) {
  if (loaded && loaded.allProfiles && loaded.currentProfileId) {
    const importedProfile = loaded.allProfiles[loaded.currentProfileId];
    if (!importedProfile) return null;
    return { profile: importedProfile, profileId: loaded.currentProfileId, mode: "snapshot" };
  }
  if (loaded && loaded.header && loaded.layout) {
    return { profile: loaded, profileId: null, mode: "profile" };
  }
  return null;
}

function importJSONFile(file, resetInputEl) {
  console.log(`${FE_LOG_PREFIX} Import started`, { name: file.name, type: file.type || "unknown", size: file.size });
  const reader = new FileReader();
  reader.onerror = function () {
    console.error(`${FE_LOG_PREFIX} FileReader failed`, reader.error);
    alert("Failed to read JSON file");
    if (resetInputEl) resetInputEl.value = '';
  };
  reader.onload = function (ev) {
    try {
      const loaded = JSON.parse(ev.target.result);
      const normalized = normalizeImportedProfile(loaded);
      if (!normalized) {
        alert("Invalid CV JSON format");
        if (resetInputEl) resetInputEl.value = '';
        return;
      }
      if (normalized.mode === "snapshot") {
        allProfiles = loaded.allProfiles;
        currentProfileId = normalized.profileId;
        data = allProfiles[currentProfileId];
      } else {
        Object.assign(data, normalized.profile);
      }
      syncInputsFromData();
      updateDensityUI();
      render(); buildExpEditor(); buildEduEditor(); buildSkillsEditor(); buildProjEditor(); buildLangEditor(); buildInterestEditor();
      hideImportModal();
      alert("CV JSON imported successfully");
    } catch (err) {
      console.error(`${FE_LOG_PREFIX} Invalid JSON file`, err);
      alert("Invalid JSON file");
    }
    if (resetInputEl) resetInputEl.value = '';
  };
  reader.readAsText(file);
}

function handleImportFile(file, resetInputEl) {
  if (!file) return;
  const fileName = (file.name || "").toLowerCase();
  const fileType = (file.type || "").toLowerCase();
  if (!fileName.endsWith('.json') && !JSON_MIME_TYPES.has(fileType)) {
    alert("Please upload a .json file exported for CV Studio.");
    if (resetInputEl) resetInputEl.value = '';
    return;
  }
  importJSONFile(file, resetInputEl);
}

function loadJSON(e) {
  const inputEl = e && e.target ? e.target : document.getElementById('load-file');
  const file = inputEl && inputEl.files ? inputEl.files[0] : null;
  handleImportFile(file, inputEl);
}

function downloadPDF() {
  const el = document.getElementById("cv-doc");
  const filename = `CV_${data.header.name.replace(/\s+/g, '_')}_${currentProfileId.replace(/\s+/g, '_')}.pdf`;
  html2pdf().set({
    margin: 0, filename: filename, image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(el).toPdf().get("pdf").then(function (pdf) {
    while (pdf.internal.getNumberOfPages() > 1) pdf.deletePage(pdf.internal.getNumberOfPages());
  }).save();
}

// ===================================================
// MOBILE ACTIONS & SCALING
// ===================================================
function mobileShowEditor() {
  document.getElementById("editor-sidebar").classList.add("mobile-open");
  document.getElementById("mob-edit-btn").classList.add("active");
  document.getElementById("mob-preview-btn").classList.remove("active");
}
function mobileShowPreview() {
  document.getElementById("editor-sidebar").classList.remove("mobile-open");
  document.getElementById("mob-preview-btn").classList.add("active");
  document.getElementById("mob-edit-btn").classList.remove("active");
}

function updatePreviewScale() {
  const container = document.querySelector('.preview-scroll');
  const doc = document.getElementById('cv-doc');
  if (!container || !doc) return;
  const winW = window.innerWidth;
  const availableW = winW <= 860 ? container.offsetWidth - 32 : container.offsetWidth - 56;
  const docW = 794;
  if (availableW < docW) {
    const scale = availableW / docW;
    doc.style.transform = `scale(${scale})`;
    if (winW <= 860) doc.style.marginBottom = `-${docW * (1 - scale)}px`;
  } else {
    doc.style.transform = 'none';
    doc.style.marginBottom = '0';
  }
}

window.addEventListener('resize', updatePreviewScale);
setTimeout(updatePreviewScale, 100);

// Layout Functions
function setDensity(d) {
  ensureLayoutData().density = d;
  updateDensityUI();
  render();
}

function updateDensityUI() {
  const layout = data.layout || {};
  const d = layout.density || "tight";
  document.querySelectorAll(".density-btn").forEach(b => b.classList.remove("active"));
  const activeBtn = document.getElementById("d-" + d); if (activeBtn) activeBtn.classList.add("active");
  const fillCheck = document.getElementById("fill-height-check");
  if (fillCheck) fillCheck.checked = !!layout.fillHeight;
  if (document.getElementById("slider-font")) {
    document.getElementById("slider-font").value = layout.fontSize || 13;
    document.getElementById("val-font").textContent = (layout.fontSize || 13) + "px";
    document.getElementById("slider-line").value = layout.lineHeight || 1.1;
    document.getElementById("val-line").textContent = layout.lineHeight || 1.1;
    document.getElementById("slider-name").value = layout.nameSize || 2.8;
    document.getElementById("val-name").textContent = (layout.nameSize || 2.8) + "rem";
  }
  const validPreset = getValidColorPresetId(layout);
  if (layout.colorPreset !== validPreset) layout.colorPreset = validPreset;
  updateColorPaletteUI();
}

function updateLayoutSetting(key, val) {
  ensureLayoutData()[key] = parseFloat(val);
  updateDensityUI();
  render();
}

function toggleFillHeight() {
  ensureLayoutData().fillHeight = document.getElementById("fill-height-check").checked;
  render();
}

function setColorPalette(presetId) {
  const preset = getColorPresetById(presetId);
  if (!preset) return;
  const layout = ensureLayoutData();
  layout.colorPreset = preset.id;
  updateDensityUI();
  render();
}

function checkOverflow() {
  const doc = document.getElementById("cv-doc");
  if (!doc) return;
  if (doc.scrollHeight > 1125) doc.classList.add("overflowing");
  else doc.classList.remove("overflowing");
}

// Start
loadFromServer();

// ===================================================
// TEMPLATE SYSTEM
// ===================================================

function setTemplate(tpl) {
  ensureLayoutData().template = tpl;
  updateTemplateUI();
  updateDensityUI();
  render();
}

function updateTemplateUI() {
  const tpl = (data.layout && data.layout.template) || "classic";
  document.querySelectorAll(".template-card").forEach(card => {
    card.classList.toggle("active", card.getAttribute("data-tpl") === tpl);
  });
}

function updatePhotoPreview() {
  const container = document.getElementById("photo-preview");
  if (!container) return;
  const photo = data.header && data.header.photo;
  const removeBtn = document.getElementById("photo-remove-btn");
  if (photo) {
    container.innerHTML = `<img class="photo-preview-img" src="${esc(photo)}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\'photo-preview-placeholder\'><i class=\'fas fa-user\'></i></div>'">`;
    if (removeBtn) removeBtn.style.display = 'flex';
  } else {
    container.innerHTML = `<div class="photo-preview-placeholder"><i class="fas fa-user"></i></div>`;
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function uploadPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Photo must be smaller than 5 MB'); event.target.value = ''; return; }
  const formData = new FormData();
  formData.append('photo', file);
  try {
    const res = await fetch('/api/upload-photo', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.url) {
      if (data.header.photo && data.header.photo.startsWith('/uploads/')) {
        fetch('/api/photo', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: data.header.photo }) }).catch(() => {});
      }
      data.header.photo = result.url;
      updatePhotoPreview();
      render();
    }
  } catch (err) { alert('Failed to upload photo.'); }
  event.target.value = '';
}

async function removePhoto() {
  if (!data.header.photo) return;
  if (data.header.photo.startsWith('/uploads/')) {
    try { await fetch('/api/photo', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: data.header.photo }) }); } catch (err) {}
  }
  data.header.photo = '';
  updatePhotoPreview();
  render();
}

// ===================================================
// MODALS
// ===================================================

let templateModalContext = null;

function showTemplateModal(context) {
  templateModalContext = context;
  const modal = document.getElementById('template-modal');
  if (modal) modal.style.display = 'flex';
}

function hideTemplateModal() {
  const modal = document.getElementById('template-modal');
  if (modal) modal.style.display = 'none';
  templateModalContext = null;
}

function selectTemplateFromModal(tpl) {
  if (templateModalContext === 'newVersion' && pendingNewVersionName) {
    const name = pendingNewVersionName;
    allProfiles[name] = JSON.parse(JSON.stringify(data));
    currentProfileId = name;
    data = allProfiles[name];
    ensureLayoutData().template = tpl;
    updateVersionSelect();
    hideTemplateModal();
    switchVersion(name);
    pendingNewVersionName = null;
  } else {
    ensureLayoutData().template = tpl;
    hideTemplateModal();
    updateTemplateUI();
    updateDensityUI();
    render();
  }
}

function triggerImportBrowse() { const input = document.getElementById('load-file'); if (input) input.click(); }
function showImportModal() { const modal = document.getElementById('import-modal'); if (modal) modal.style.display = 'flex'; }
function hideImportModal() { const modal = document.getElementById('import-modal'); if (modal) modal.style.display = 'none'; }

async function copyImportPrompt(buttonEl) {
  const promptEl = document.getElementById('import-tip-prompt');
  if (!promptEl) return;
  try {
    await navigator.clipboard.writeText(promptEl.value);
    if (buttonEl) {
      const original = buttonEl.innerHTML;
      buttonEl.classList.add('copied');
      buttonEl.innerHTML = '<i class="fas fa-check"></i> Copied';
      setTimeout(() => { buttonEl.classList.remove('copied'); buttonEl.innerHTML = original; }, 1600);
    }
  } catch (err) { alert('Could not copy prompt.'); }
}

function initImportModal() {
  const dropZone = document.getElementById('import-drop-zone');
  if (!dropZone) return;
  const preventDefaults = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(n => dropZone.addEventListener(n, e => { preventDefaults(e); dropZone.classList.add('drag-active'); }));
  ['dragleave', 'dragend', 'drop'].forEach(n => dropZone.addEventListener(n, e => { preventDefaults(e); dropZone.classList.remove('drag-active'); }));
  dropZone.addEventListener('drop', e => { const file = e.dataTransfer?.files?.[0]; handleImportFile(file, null); });
}
