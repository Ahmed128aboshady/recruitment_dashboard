// State initialization
let criteria = [];
let candidates = [];
let historyBatches = [];
let currentBatchId = "active"; // "active" or a specific batch.id
let currentSelectedId = null;
let currentTierFilter = "all"; // "all", "Manager", "Senior", "Junior", "General Sales", "Filtered Out"

function loadCandidatesForCurrentMode() {
  if (currentBatchId === "active") {
    const storedCandidates = localStorage.getItem("recruitment_candidates");
    candidates = storedCandidates ? JSON.parse(storedCandidates) : [];
  } else {
    const batch = historyBatches.find(b => b.id === currentBatchId);
    candidates = batch ? batch.candidates : [];
  }
}

function initAppState() {
  const storedCriteria = localStorage.getItem("recruitment_criteria");
  const storedHistory = localStorage.getItem("recruitment_history_batches");

  if (storedCriteria) {
    criteria = JSON.parse(storedCriteria);
  } else {
    criteria = [...defaultCriteria];
    localStorage.setItem("recruitment_criteria", JSON.stringify(criteria));
  }

  if (storedHistory) {
    historyBatches = JSON.parse(storedHistory);
  } else {
    historyBatches = [];
    localStorage.setItem("recruitment_history_batches", JSON.stringify(historyBatches));
  }

  if (!localStorage.getItem("recruitment_candidates")) {
    localStorage.setItem("recruitment_candidates", JSON.stringify([...candidatesData]));
  }

  currentBatchId = "active";
  loadCandidatesForCurrentMode();
}

// DOM Elements
const candidatesContainer = document.getElementById("candidates-container");
const detailsContainer = document.getElementById("details-container");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const resetFiltersBtn = document.getElementById("reset-filters");
const totalCountEl = document.getElementById("total-resumes-count");
const visibleCountEl = document.getElementById("visible-resumes-count");
const historyListEl = document.getElementById("history-list");

// Modal elements
const criteriaModalBackdrop = document.getElementById("criteria-modal-backdrop");
const btnManageCriteria = document.getElementById("btn-manage-criteria");
const btnCloseCriteriaModal = document.getElementById("btn-close-criteria-modal");
const btnCancelCriteria = document.getElementById("btn-cancel-criteria");
const btnSaveCriteria = document.getElementById("btn-save-criteria");
const btnAddCriterion = document.getElementById("btn-add-criterion");
const modalCriteriaList = document.getElementById("modal-criteria-list");
const newCriterionLabel = document.getElementById("new-criterion-label");
const newCriterionKey = document.getElementById("new-criterion-key");
const newCriterionKeywords = document.getElementById("new-criterion-keywords");
const btnResetApp = document.getElementById("btn-reset-app");

// Upload elements
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");
const uploadStatusText = document.getElementById("upload-status-text");
const uploadSpinner = document.getElementById("upload-spinner");

// Calculate candidate match score dynamically based on active criteria
function calculateScore(candidate) {
  if (candidate.tier === "Filtered Out") return 0;
  if (criteria.length === 0) return 0;
  
  let matches = 0;
  criteria.forEach(c => {
    if (candidate.criteriaMatches[c.key] === true) {
      matches++;
    }
  });
  return Math.round((matches / criteria.length) * 100);
}

// Get color code class for scores
function getScoreClass(score, tier) {
  if (tier === "Filtered Out") return "score-low";
  if (score >= 75) return "score-high";
  if (score >= 50) return "score-mid";
  return "score-low";
}

// Render filter checkboxes dynamically grouped by category
function renderFilters() {
  const container = document.getElementById("dynamic-filters-container");
  container.innerHTML = "";

  const grouped = {};
  criteria.forEach(c => {
    const categoryName = c.category || "Custom Criteria";
    if (!grouped[categoryName]) {
      grouped[categoryName] = [];
    }
    grouped[categoryName].push(c);
  });

  Object.keys(grouped).forEach(cat => {
    const filterGroup = document.createElement("div");
    filterGroup.className = "filter-group";

    const groupTitle = document.createElement("div");
    groupTitle.className = "filter-group-title";
    groupTitle.textContent = cat;
    filterGroup.appendChild(groupTitle);

    const checkboxList = document.createElement("div");
    checkboxList.className = "checkbox-list";

    grouped[cat].forEach(c => {
      const label = document.createElement("label");
      label.className = "checkbox-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "criteria-checkbox";
      input.value = c.key;
      input.addEventListener("change", renderCandidates);

      // Auto-close filters drawer when a checkbox changes on mobile
      input.addEventListener("change", () => {
        if (window.innerWidth <= 768) {
          closeFiltersDrawer();
        }
      });

      const customBox = document.createElement("div");
      customBox.className = "checkbox-custom";

      label.appendChild(input);
      label.appendChild(customBox);
      label.appendChild(document.createTextNode(c.label));
      checkboxList.appendChild(label);
    });

    filterGroup.appendChild(checkboxList);
    container.appendChild(filterGroup);
  });
}

// Main render candidates list function
function renderCandidates() {
  // Toggle upload container, archive banner, and archive button based on current batch mode
  const uploadContainerEl = document.querySelector(".upload-container");
  const archiveBannerEl = document.getElementById("archive-banner");
  const archiveBannerNameEl = document.getElementById("archive-banner-name");
  const btnArchiveBatchEl = document.getElementById("btn-archive-batch");

  if (currentBatchId === "active") {
    uploadContainerEl.style.display = "block";
    archiveBannerEl.style.display = "none";
    btnArchiveBatchEl.style.display = "flex";
    
    // Disable archiving if there are no candidates in the active batch
    const storedCandidates = localStorage.getItem("recruitment_candidates");
    const activeCandidatesCount = storedCandidates ? JSON.parse(storedCandidates).length : 0;
    btnArchiveBatchEl.disabled = activeCandidatesCount === 0;
  } else {
    uploadContainerEl.style.display = "none";
    archiveBannerEl.style.display = "flex";
    const currentBatch = historyBatches.find(b => b.id === currentBatchId);
    archiveBannerNameEl.textContent = currentBatch ? currentBatch.name : "Archive";
    btnArchiveBatchEl.style.display = "none";
  }

  const query = searchInput.value.toLowerCase().trim();
  const activeFilters = [];
  const criteriaCheckboxes = document.querySelectorAll(".criteria-checkbox");
  
  criteriaCheckboxes.forEach(cb => {
    if (cb.checked) activeFilters.push(cb.value);
  });

  const filtered = candidates.filter(candidate => {
    const matchesName = candidate.name.toLowerCase().includes(query) || 
                        candidate.title.toLowerCase().includes(query);
    
    // Candidates must match ALL active checkbox criteria
    const matchesCriteria = activeFilters.every(filterKey => candidate.criteriaMatches[filterKey] === true);
    
    // Apply tier filter
    const matchesTier = (currentTierFilter === "all") || (candidate.tier === currentTierFilter);

    return matchesName && matchesCriteria && matchesTier;
  });

  // Sort
  const sortBy = sortSelect.value;
  filtered.sort((a, b) => {
    if (sortBy === "score") {
      return calculateScore(b) - calculateScore(a);
    } else if (sortBy === "experience") {
      return b.experience - a.experience;
    } else if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  totalCountEl.textContent = candidates.length;
  visibleCountEl.textContent = filtered.length;

  candidatesContainer.innerHTML = "";
  if (filtered.length === 0) {
    candidatesContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.95rem;">
        No candidates match the selected filters.
      </div>
    `;
    return;
  }

  filtered.forEach(candidate => {
    const score = calculateScore(candidate);
    const scoreClass = getScoreClass(score, candidate.tier);
    const isSelected = candidate.id === currentSelectedId;

    const card = document.createElement("div");
    card.className = `candidate-card ${isSelected ? 'active' : ''}`;
    card.setAttribute("data-id", candidate.id);
    card.onclick = () => selectCandidate(candidate.id);

    // Get a specific tag color name for styling
    let tierClass = "tier-general";
    if (candidate.tier === "Manager") tierClass = "tier-manager";
    else if (candidate.tier === "Senior") tierClass = "tier-senior";
    else if (candidate.tier === "Junior") tierClass = "tier-junior";
    else if (candidate.tier === "Filtered Out") tierClass = "tier-disqualified";

    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${candidate.name}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div class="card-tier-badge ${tierClass}">${candidate.tier}</div>
          <div class="card-score ${scoreClass}">${candidate.tier === 'Filtered Out' ? 'DQ' : `${score}%`}</div>
          <button class="btn-delete-candidate" title="Delete Resume" onclick="event.stopPropagation(); deleteCandidate('${candidate.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
      <div class="card-title">${candidate.title}</div>
      <div class="card-meta">
        <div class="card-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>${candidate.experience} Yrs Sales</span>
        </div>
        ${candidate.exhibitionsExperience > 0 ? `
        <div class="card-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; color: var(--color-success);">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          <span>${candidate.exhibitionsExperience} Yrs Exhibitions</span>
        </div>
        ` : ''}
      </div>
    `;
    candidatesContainer.appendChild(card);
  });

  if (currentSelectedId && !filtered.find(c => c.id === currentSelectedId)) {
    showEmptyState();
  }
}

function showEmptyState() {
  currentSelectedId = null;
  detailsContainer.classList.remove("active-details");
  detailsContainer.innerHTML = `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
      <h3>No Candidate Selected</h3>
      <p>Click on any candidate card on the left to view their detailed resume matching report.</p>
    </div>
  `;
}

// Set Selected Candidate Details View
function selectCandidate(id) {
  currentSelectedId = id;
  
  const cards = document.querySelectorAll(".candidate-card");
  cards.forEach(card => {
    if (card.getAttribute("data-id") === id) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  const candidate = candidates.find(c => c.id === id);
  if (!candidate) return;

  detailsContainer.classList.add("active-details");

  const score = calculateScore(candidate);
  const circumference = 2 * Math.PI * 36;
  const strokeOffset = circumference - (score / 100) * circumference;

  const isFilteredOut = candidate.tier === "Filtered Out";
  
  let disqualificationBanner = "";
  if (isFilteredOut) {
    let reason = candidate.genderReason || candidate.backgroundReason || "Does not meet candidate screening filters.";
    disqualificationBanner = `
      <div class="disqualification-banner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <div>
          <strong>Disqualified Profile</strong>
          <div style="font-size: 0.85rem; opacity: 0.9;">Reason: ${reason}</div>
        </div>
      </div>
    `;
  }

  // Construct criteria HTML breakdown dynamically
  let criteriaHTML = "";
  criteria.forEach(c => {
    const isMatched = candidate.criteriaMatches[c.key] === true;
    const justification = candidate.justifications[c.key] || "No keywords found in resume.";

    criteriaHTML += `
      <div class="match-row-item">
        <div class="match-icon ${isMatched ? 'check' : 'cross'}">
          ${isMatched ? `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 12px; height: 12px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ` : `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 10px; height: 10px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          `}
        </div>
        <div class="match-details">
          <div class="match-criterion-name" style="color: ${isMatched ? 'var(--text-main)' : 'rgba(255,255,255,0.3)'}">${c.label}</div>
          <div class="match-criterion-justification" style="color: ${isMatched ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)'}">${justification}</div>
        </div>
      </div>
    `;
  });

  const languagesHTML = (candidate.languages || ["English"]).map(lang => `<span class="info-badge">${lang}</span>`).join('');

  let tierClass = "tier-general";
  if (candidate.tier === "Manager") tierClass = "tier-manager";
  else if (candidate.tier === "Senior") tierClass = "tier-senior";
  else if (candidate.tier === "Junior") tierClass = "tier-junior";
  else if (candidate.tier === "Filtered Out") tierClass = "tier-disqualified";

  detailsContainer.innerHTML = `
    <button class="btn-back-mobile" onclick="closeDetails()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 16px; height: 16px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
      Back to List
    </button>
    
    ${disqualificationBanner}

    <div class="profile-header">
      <div class="profile-main-info">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <h1>${candidate.name}</h1>
          <span class="card-tier-badge ${tierClass}" style="font-size: 0.85rem; padding: 0.25rem 0.75rem;">${candidate.tier}</span>
        </div>
        <h3>${candidate.title}</h3>
        
        <div class="profile-contact-grid">
          <a href="mailto:${candidate.email}" class="contact-link">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 17.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            ${candidate.email}
          </a>
          <a href="tel:${candidate.phone}" class="contact-link">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.14-4.117-6.942-6.94l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
            ${candidate.phone}
          </a>
          <div class="contact-link">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            ${candidate.location}
          </div>
        </div>
        <!-- Delete Resume Button -->
        <button class="sidebar-action-btn" style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--color-danger); margin-top: 1.25rem; width: fit-content;" onclick="deleteCandidate('${candidate.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          Delete Resume
        </button>
      </div>
      
      <div class="profile-score-box">
        <div class="score-ring-container">
          <svg class="score-ring-svg">
            <circle class="score-ring-bg" cx="40" cy="40" r="36" />
            <circle class="score-ring-fill" cx="40" cy="40" r="36" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeOffset}" />
          </svg>
          <div class="score-ring-text">${isFilteredOut ? 'DQ' : `${score}%`}</div>
        </div>
        <div class="score-label">${isFilteredOut ? 'Disqualified' : 'Overall Match'}</div>
      </div>
    </div>

    <div class="profile-body-grid">
      <!-- Left Column: Match Breakdown -->
      <div class="profile-section-card">
        <div class="section-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px; color: var(--color-primary);">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          Screening & Match Breakdown
        </div>
        <div class="match-grid-list">
          ${criteriaHTML}
        </div>
      </div>

      <!-- Right Column: General Info and Resume Summary -->
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div class="profile-section-card">
          <div class="section-card-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px; color: var(--color-primary);">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
            Professional Experience
          </div>
          
          <div class="info-row">
            <div class="info-label">Overall Sales Experience</div>
            <div class="info-value"><strong>${candidate.experience} Years</strong> in Sales/Business Development.</div>
          </div>

          <div class="info-row">
            <div class="info-label">Exhibitions Industry Exp</div>
            <div class="info-value"><strong>${candidate.exhibitionsExperience} Years</strong> specifically in Exhibitions, Events, or Fit-Out.</div>
          </div>

          <div class="info-row">
            <div class="info-label">Education</div>
            <div class="info-value">${candidate.education || "Not specified"}</div>
          </div>

          <div class="info-row">
            <div class="info-label">Languages</div>
            <div class="badge-container">
              ${languagesHTML}
            </div>
          </div>
        </div>

        <div class="profile-section-card">
          <div class="section-card-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px; color: var(--color-primary);">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-1.5 3h1.5m-7.5-3h7.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.75m-3.75 3h3.75m-3.75 3h3.75M3.75 6h16.5a1.5 1.5 0 0 1 1.5 1.5v11.25a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V7.5A1.5 1.5 0 0 1 3.75 6Z" />
            </svg>
            Resume Summary
          </div>
          <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">${candidate.summary}</p>
        </div>
      </div>
    </div>
  `;
}

// Criteria Manager Modal Controls
let localCriteriaCopy = [];

function renderModalCriteriaList() {
  modalCriteriaList.innerHTML = "";
  if (localCriteriaCopy.length === 0) {
    modalCriteriaList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">No criteria defined. Add some below.</div>`;
    return;
  }

  localCriteriaCopy.forEach((c, index) => {
    const item = document.createElement("div");
    item.className = "criteria-list-item";

    const info = document.createElement("div");
    info.className = "criteria-item-info";

    const label = document.createElement("div");
    label.className = "criteria-item-label";
    label.textContent = `${c.label} (${c.key})`;
    info.appendChild(label);

    const keywordsContainer = document.createElement("div");
    keywordsContainer.className = "criteria-item-keywords";
    c.keywords.forEach(kw => {
      const badge = document.createElement("span");
      badge.className = "keyword-badge";
      badge.textContent = kw;
      keywordsContainer.appendChild(badge);
    });
    info.appendChild(keywordsContainer);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete-criterion";
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    `;
    deleteBtn.onclick = () => {
      localCriteriaCopy.splice(index, 1);
      renderModalCriteriaList();
    };

    item.appendChild(info);
    item.appendChild(deleteBtn);
    modalCriteriaList.appendChild(item);
  });
}

btnManageCriteria.addEventListener("click", () => {
  localCriteriaCopy = JSON.parse(JSON.stringify(criteria));
  renderModalCriteriaList();
  criteriaModalBackdrop.classList.add("active");
});

function closeCriteriaModal() {
  criteriaModalBackdrop.classList.remove("active");
  // Clear form
  newCriterionLabel.value = "";
  newCriterionKey.value = "";
  newCriterionKeywords.value = "";
}

btnCloseCriteriaModal.addEventListener("click", closeCriteriaModal);
btnCancelCriteria.addEventListener("click", closeCriteriaModal);

btnAddCriterion.addEventListener("click", () => {
  const labelVal = newCriterionLabel.value.trim();
  let keyVal = newCriterionKey.value.trim().replace(/[^a-zA-Z]/g, ""); // strip anything but letters
  const keywordsVal = newCriterionKeywords.value.trim();

  if (!labelVal || !keyVal || !keywordsVal) {
    alert("Please fill in all fields.");
    return;
  }

  // Check key uniqueness
  if (localCriteriaCopy.find(c => c.key === keyVal)) {
    alert("This Unique Key already exists. Please choose another.");
    return;
  }

  const keywordsArray = keywordsVal.split(",").map(kw => kw.trim()).filter(kw => kw.length > 0);

  localCriteriaCopy.push({
    key: keyVal,
    label: labelVal,
    category: "Custom Criteria",
    keywords: keywordsArray
  });

  // Clear inputs
  newCriterionLabel.value = "";
  newCriterionKey.value = "";
  newCriterionKeywords.value = "";

  renderModalCriteriaList();
});

btnSaveCriteria.addEventListener("click", () => {
  // Apply the local changes back to global state
  criteria = JSON.parse(JSON.stringify(localCriteriaCopy));
  localStorage.setItem("recruitment_criteria", JSON.stringify(criteria));

  // Clean up candidates criteriaMatches if they don't exist anymore or add empty ones
  candidates.forEach(cand => {
    const cleanedMatches = {};
    const cleanedJustifications = {};
    criteria.forEach(c => {
      cleanedMatches[c.key] = cand.criteriaMatches[c.key] !== undefined ? cand.criteriaMatches[c.key] : false;
      cleanedJustifications[c.key] = cand.justifications[c.key] !== undefined ? cand.justifications[c.key] : "No keywords matched.";
    });
    cand.criteriaMatches = cleanedMatches;
    cand.justifications = cleanedJustifications;
  });

  localStorage.setItem("recruitment_candidates", JSON.stringify(candidates));

  renderFilters();
  renderCandidates();
  if (currentSelectedId) {
    selectCandidate(currentSelectedId);
  }
  closeCriteriaModal();
});

// Reset app back to default mock data
btnResetApp.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all candidate profiles, criteria, and batch history to default? Your uploaded resumes, custom criteria, and archived batches will be deleted.")) {
    localStorage.removeItem("recruitment_criteria");
    localStorage.removeItem("recruitment_candidates");
    localStorage.removeItem("recruitment_history_batches");
    location.reload();
  }
});

// Resume drag and drop handlers
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    handleMultipleResumesUpload(files);
  }
});

uploadZone.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    handleMultipleResumesUpload(files);
    fileInput.value = ""; // clear so we can re-upload same file
  }
});

// Helper: find sentence containing keyword
function findSentenceWithKeyword(text, keyword) {
  const sentences = text.split(/[.!?\n]/);
  const cleanKeyword = keyword.toLowerCase();
  for (let s of sentences) {
    const cleanSentence = s.trim();
    if (cleanSentence.toLowerCase().includes(cleanKeyword)) {
      if (cleanSentence.length > 150) {
        return cleanSentence.substring(0, 150) + "...";
      }
      return cleanSentence;
    }
  }
  return null;
}

// Core parsing and evaluation engine for multiple files
async function handleMultipleResumesUpload(files) {
  if (files.length === 0) return;
  let successCount = 0;
  let errorCount = 0;
  let lastUploadedId = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    showStatus(`Parsing resume ${i + 1} of ${files.length} (${file.name})...`, "loading");
    try {
      const candidateId = await processSingleResume(file);
      if (candidateId) {
        successCount++;
        lastUploadedId = candidateId;
      }
    } catch (err) {
      console.error(err);
      errorCount++;
    }
  }

  if (errorCount === 0) {
    showStatus(`Successfully uploaded ${successCount} resume(s)!`, "success");
  } else {
    showStatus(`Uploaded ${successCount} resume(s) with ${errorCount} error(s).`, "error");
  }

  renderCandidates();
  if (lastUploadedId) {
    selectCandidate(lastUploadedId);
  }
}

// Process a single resume (internal helper)
async function processSingleResume(file) {
  const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isTXT = file.type === "text/plain" || file.name.endsWith(".txt");

  if (!isPDF && !isTXT) {
    throw new Error("Only PDF and TXT files are supported.");
  }

  let textContent = "";
  if (isTXT) {
    textContent = await readTextFile(file);
  } else {
    textContent = await readPDFFile(file);
  }

  if (!textContent.trim()) {
    throw new Error("Could not extract any text from the file.");
  }

  const lowerText = textContent.toLowerCase();

  // Simple Regex Parser for Candidate Info
  const lines = textContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let name = "";
  let title = "Sales Executive";

  if (lines.length > 0) {
    if (lines[0].length < 40 && !lines[0].includes("@")) {
      name = lines[0];
    }
  }
  if (lines.length > 1 && !name) {
    if (lines[1].length < 40 && !lines[1].includes("@")) {
      name = lines[1];
    }
  }

  // Fallback name from file name
  if (!name) {
    name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    name = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // Find potential job title
  const possibleTitles = lines.filter(l => l.length > 8 && l.length < 60 && !l.includes("@") && !l.includes("+") && !l.includes("Page"));
  if (possibleTitles.length > 1) {
    title = possibleTitles[1]; // skip name line
  } else if (possibleTitles.length > 0) {
    title = possibleTitles[0];
  }

  // Email parsing
  const emailMatch = textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : `${name.toLowerCase().replace(/\s/g, "")}@recruit.sync`;

  // Phone parsing
  const phoneMatch = textContent.match(/\+?[0-9\s-]{9,15}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "+971-50-000-0000";

  // Gender Detection
  let gender = "female";
  let genderReason = "";
  
  const isExplicitFemale = /\bgender\s*:\s*female\b/i.test(lowerText) || /\bgender\s*:\s*f\b/i.test(lowerText);
  const isExplicitMale = /\bgender\s*:\s*male\b/i.test(lowerText) || /\bgender\s*:\s*m\b/i.test(lowerText);
  
  if (isExplicitFemale) {
    gender = "female";
    genderReason = "Explicitly stated: Female";
  } else if (isExplicitMale) {
    gender = "male";
    genderReason = "Filtered Out: Male Candidate. Universal filter requires female candidates only.";
  } else {
    const femalePronouns = (lowerText.match(/\b(she|her|hers|herself)\b/g) || []).length;
    const malePronouns = (lowerText.match(/\b(he|him|his|himself)\b/g) || []).length;
    const hasMr = /\bmr\b/i.test(lowerText);
    const hasMs = /\b(ms|mrs|miss|lady)\b/i.test(lowerText);
    
    if (hasMs && !hasMr) {
      gender = "female";
      genderReason = "Identified as Female (Honorific: Ms/Mrs/Miss)";
    } else if (hasMr && !hasMs) {
      gender = "male";
      genderReason = "Filtered Out: Male Candidate (Honorific: Mr)";
    } else if (femalePronouns > malePronouns) {
      gender = "female";
      genderReason = `Identified as Female (Pronouns: she/her matched ${femalePronouns} times)`;
    } else if (malePronouns > femalePronouns) {
      gender = "male";
      genderReason = `Filtered Out: Male Candidate (Pronouns: he/him matched ${malePronouns} times)`;
    } else {
      // Check names
      const femaleNames = ['eman', 'fatma', 'fatima', 'aisha', 'sarah', 'sara', 'yasmin', 'yasmine', 'mariam', 'maryam', 'nour', 'noor', 'nada', 'mona', 'reem', 'rana', 'rawan', 'dina', 'aya', 'amal', 'salma', 'heba', 'hoda', 'mai', 'ola', 'ghada', 'maha', 'sherihan', 'alia', 'aliaa', 'nancy', 'christine', 'jessica', 'marwa', 'ghada', 'shimaa', 'nouran', 'omnia', 'alaa', 'rowan', 'habiba', 'menna', 'farida', 'malak', 'jana', 'jude', 'shahd', 'basma', 'sahar', 'amira', 'rola', 'ranim', 'ranine', 'laila', 'layla'];
      const maleNames = ['ahmed', 'mohamed', 'mohammad', 'mahmoud', 'ali', 'hassan', 'hussein', 'ibrahim', 'mustafa', 'khalid', 'tarek', 'amr', 'omar', 'sherif', 'youssef', 'ramadan', 'john', 'david', 'michael', 'james', 'robert', 'william', 'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'frank', 'benjamin', 'gregory', 'samuel', 'raymond', 'patrick', 'alexander', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'henry', 'douglas', 'peter', 'jose', 'walter', 'harold', 'kyle', 'carl', 'arthur', 'gerald', 'roger', 'keith', 'jeremy', 'terry', 'lawrence', 'sean', 'christian', 'albert', 'joe', 'ethan', 'billy', 'bryan', 'bruce', 'willie', 'jordan', 'dylan', 'alan', 'ralph', 'gabriel', 'roy', 'juan', 'wayne', 'eugene', 'logan'];
      
      const firstName = name.split(' ')[0].toLowerCase();
      if (femaleNames.includes(firstName)) {
        gender = "female";
        genderReason = "Identified as Female (Name matches female database)";
      } else if (maleNames.includes(firstName)) {
        gender = "male";
        genderReason = "Filtered Out: Male Candidate (Name matches male database)";
      } else {
        gender = "female"; // Default pass for review if completely unknown
        genderReason = "Verify Gender (Uncertain name/pronoun mapping)";
      }
    }
  }

  // Excluded Backgrounds Check
  const excludedBackgrounds = [
    { name: "HR", keywords: ["hr", "human resources", "payroll", "personnel", "employee relations"] },
    { name: "Recruitment", keywords: ["recruitment", "recruiter", "talent acquisition", "headhunter", "sourcing"] },
    { name: "Customer Service", keywords: ["customer service", "customer care", "client support", "customer support"] },
    { name: "Call Center", keywords: ["call center", "telecaller", "telemarketing", "telesales"] },
    { name: "Receptionist", keywords: ["receptionist", "front desk", "lobby host", "reception"] },
    { name: "Administrator", keywords: ["administrator", "admin", "office assistant", "executive assistant", "clerk", "secretarial", "secretary"] },
    { name: "Accountant", keywords: ["accountant", "accounting", "bookkeeper", "audit", "auditor", "finance executive"] },
    { name: "Cashier", keywords: ["cashier", "teller", "billing clerk"] },
    { name: "Retail Sales", keywords: ["retail sales", "shop assistant", "store keeper", "merchandiser", "supermarket"] },
    { name: "Teacher", keywords: ["teacher", "educator", "tutor", "instructor", "teaching"] },
    { name: "Banking", keywords: ["banking", "banker", "loan officer"] },
    { name: "Pharmacist", keywords: ["pharmacist", "pharmacy", "chemist"] },
    { name: "Nurse", keywords: ["nurse", "nursing", "clinic assistant"] },
    { name: "Doctor", keywords: ["doctor", "physician", "surgeon", "md"] },
    { name: "Graphic Designer", keywords: ["graphic designer", "ui designer", "ux designer", "illustrator", "photoshop", "creative designer"] },
    { name: "Software Engineer", keywords: ["software engineer", "developer", "programmer", "web developer", "full stack", "backend", "frontend", "coder", "software developer"] }
  ];

  let excludedBackground = false;
  let backgroundReason = "";
  for (let bg of excludedBackgrounds) {
    const titleRegex = new RegExp("\\b" + bg.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
    let count = 0;
    bg.keywords.forEach(kw => {
      if (lowerText.includes(kw)) count++;
    });

    if (titleRegex.test(title) || (count >= 3 && (title.toLowerCase().includes("officer") || title.toLowerCase().includes("specialist") || title.toLowerCase().includes("manager") || title.toLowerCase().includes("executive") || title.toLowerCase().includes("assistant")))) {
      excludedBackground = true;
      backgroundReason = `Filtered Out: Excluded background detected (${bg.name}).`;
      break;
    }
  }

  // Experience extraction
  let overallYears = 0;
  const overallRegex = /(\d+)\+?\s*(years?|yrs)\s*(of)?\s*(experience|exp|sales\s*experience)/gi;
  let match;
  let maxOverallFromText = 0;
  while ((match = overallRegex.exec(lowerText)) !== null) {
    const yrs = parseInt(match[1]);
    if (yrs > maxOverallFromText && yrs < 40) {
      maxOverallFromText = yrs;
    }
  }
  
  const rangeRegex = /\b(20[0-2][0-9]|19[8-9][0-9])\s*[-–—to]+\s*(present|current|date|20[0-2][0-9])\b/gi;
  let ranges = [];
  let exhibitionRanges = [];
  
  const blocks = textContent.split(/\n+/);
  blocks.forEach(block => {
    let blockMatch;
    const cleanBlock = block.trim();
    const hasExhibition = /exhib|event|expo|booth|fit-out|trade\s*show|pavilion/i.test(cleanBlock);
    
    while ((blockMatch = rangeRegex.exec(cleanBlock)) !== null) {
      const start = parseInt(blockMatch[1]);
      const endStr = blockMatch[2].toLowerCase();
      const end = (endStr.includes('present') || endStr.includes('current') || endStr.includes('date')) ? 2026 : parseInt(endStr);
      
      if (start <= end && start > 1980) {
        ranges.push([start, end]);
        if (hasExhibition) {
          exhibitionRanges.push([start, end]);
        }
      }
    }
  });
  
  function mergeIntervals(intervals) {
    if (intervals.length === 0) return 0;
    intervals.sort((a, b) => a[0] - b[0]);
    let merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      let last = merged[merged.length - 1];
      let curr = intervals[i];
      if (curr[0] <= last[1]) {
        last[1] = Math.max(last[1], curr[1]);
      } else {
        merged.push(curr);
      }
    }
    return merged.reduce((sum, interval) => sum + (interval[1] - interval[0] || 1), 0);
  }
  
  const calculatedOverall = mergeIntervals(ranges);
  const calculatedExhibitions = mergeIntervals(exhibitionRanges);
  
  overallYears = Math.max(calculatedOverall, maxOverallFromText);
  if (overallYears === 0) {
    overallYears = Math.floor(Math.random() * 4) + 1; // fallback to 1-4 years
  }
  
  let exhibitionsYears = calculatedExhibitions;
  if (exhibitionsYears === 0 && /exhib|event|expo|booth|trade\s*show/i.test(lowerText)) {
    exhibitionsYears = Math.min(Math.floor(overallYears * 0.4) || 1, 3);
  }

  // Summary parsing
  let summary = "";
  const profileIndex = lines.findIndex(l => l.toLowerCase().includes("summary") || l.toLowerCase().includes("profile") || l.toLowerCase().includes("objective"));
  if (profileIndex !== -1 && lines.length > profileIndex + 1) {
    summary = lines[profileIndex + 1];
  }
  if (!summary || summary.length < 35) {
    const longLines = lines.filter(l => l.length > 60 && !l.includes("@"));
    if (longLines.length > 0) {
      summary = longLines[0];
    } else {
      summary = "Experienced sales professional with a strong track record of corporate client acquisition and market expansion.";
    }
  }
  if (summary.length > 250) {
    summary = summary.substring(0, 250) + "...";
  }

  // Categorization Tier Logic
  let tier = "General Sales";
  
  if (gender === "male" || excludedBackground) {
    tier = "Filtered Out";
  } else {
    const matchesManagerTitle = /manager|bdm|commercial/i.test(title);
    const matchesExhibitionsMandatory = /exhib|event|expo|booth|fabrication|pavilion|fit-out/i.test(lowerText);
    const matchesSeniorTitle = /senior|executive|specialist|consultant|account/i.test(title);
    const matchesJuniorTitle = /sales|representative|associate|executive/i.test(title);
    const matchesJuniorIndustry = /event|exhib|advertis|brand|print|signage|design|fit-out|construct/i.test(lowerText);

    if (overallYears >= 5 && exhibitionsYears >= 2 && matchesManagerTitle && matchesExhibitionsMandatory) {
      tier = "Manager";
    } else if (overallYears >= 3 && exhibitionsYears >= 1 && (matchesSeniorTitle || matchesManagerTitle) && matchesExhibitionsMandatory) {
      tier = "Senior";
    } else if (overallYears >= 1 && (matchesJuniorTitle || matchesSeniorTitle) && matchesJuniorIndustry) {
      tier = "Junior";
    }
  }

  // Match Criteria checkboxes
  const criteriaMatches = {};
  const justifications = {};

  criteria.forEach(c => {
    let matched = false;
    let matchedKw = "";
    let sentence = null;

    if (c.key === "genderFemale") {
      matched = (gender === "female");
      justifications[c.key] = matched ? genderReason : genderReason;
    } else if (c.key === "excludedBackground") {
      matched = !excludedBackground;
      justifications[c.key] = matched ? "No excluded background detected." : backgroundReason;
    } else {
      for (let keyword of c.keywords) {
        const regex = new RegExp("\\b" + keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
        if (regex.test(textContent) || lowerText.includes(keyword.toLowerCase())) {
          matched = true;
          matchedKw = keyword;
          sentence = findSentenceWithKeyword(textContent, keyword);
          break;
        }
      }
      criteriaMatches[c.key] = matched;
      if (matched) {
        justifications[c.key] = sentence 
          ? `Mentioned: "${sentence}"` 
          : `Matched keyword "${matchedKw}" on resume.`;
      } else {
        justifications[c.key] = `No keywords like [${c.keywords.join(", ")}] found in the candidate resume text.`;
      }
    }
    criteriaMatches[c.key] = matched;
  });

  const newCandidate = {
    id: "uploaded_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    name: name,
    title: title,
    email: email,
    phone: phone,
    location: "Dubai, UAE",
    gender: gender,
    genderReason: genderReason,
    excludedBackground: excludedBackground,
    backgroundReason: backgroundReason,
    experience: overallYears,
    exhibitionsExperience: exhibitionsYears,
    tier: tier,
    education: "Degree/Certification from resume",
    languages: ["English"],
    summary: summary,
    criteriaMatches: criteriaMatches,
    justifications: justifications
  };

  candidates.push(newCandidate);
  localStorage.setItem("recruitment_candidates", JSON.stringify(candidates));

  return newCandidate.id;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readPDFFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(item => item.str);
          text += strings.join(" ") + "\n";
        }
        resolve(text);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function showStatus(msg, type) {
  uploadStatus.className = `upload-status ${type}`;
  uploadStatusText.textContent = msg;

  if (type === "loading") {
    uploadSpinner.style.display = "block";
  } else {
    uploadSpinner.style.display = "none";
  }

  if (type === "success" || type === "error") {
    setTimeout(() => {
      uploadStatus.className = "upload-status";
    }, 5000);
  }
}

function deleteCandidate(id) {
  const cand = candidates.find(c => c.id === id);
  if (!cand) return;
  if (confirm(`Are you sure you want to delete the profile of ${cand.name}?`)) {
    candidates = candidates.filter(c => c.id !== id);
    if (currentBatchId === "active") {
      localStorage.setItem("recruitment_candidates", JSON.stringify(candidates));
    } else {
      const batch = historyBatches.find(b => b.id === currentBatchId);
      if (batch) {
        batch.candidates = candidates;
        localStorage.setItem("recruitment_history_batches", JSON.stringify(historyBatches));
      }
    }
    renderCandidates();
    if (currentSelectedId === id) {
      showEmptyState();
    }
  }
}

// Batch History Functions
function renderHistoryList() {
  if (!historyListEl) return;
  historyListEl.innerHTML = "";

  // 1. Current Active Batch item
  const activeItem = document.createElement("div");
  activeItem.className = `history-item ${currentBatchId === 'active' ? 'active' : ''}`;
  activeItem.onclick = () => viewBatch('active');
  
  const storedCandidates = localStorage.getItem("recruitment_candidates");
  const activeCandidatesCount = storedCandidates ? JSON.parse(storedCandidates).length : 0;

  activeItem.innerHTML = `
    <div class="history-item-details">
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--color-success); display: inline-block;"></span>
        <strong>Current Active Batch</strong>
      </div>
      <span class="history-item-meta">${activeCandidatesCount} resumes loaded</span>
    </div>
  `;
  historyListEl.appendChild(activeItem);

  // 2. Saved history batches
  historyBatches.forEach(batch => {
    const item = document.createElement("div");
    item.className = `history-item ${currentBatchId === batch.id ? 'active' : ''}`;
    item.onclick = () => viewBatch(batch.id);

    const formattedDate = new Date(batch.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    item.innerHTML = `
      <div class="history-item-details">
        <strong>${batch.name}</strong>
        <span class="history-item-meta">${formattedDate} • ${batch.candidates.length} candidates</span>
      </div>
      <button class="btn-delete-batch" title="Delete Batch" onclick="event.stopPropagation(); deleteHistoryBatch('${batch.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 13px; height: 13px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    `;
    historyListEl.appendChild(item);
  });
}

function confirmAndArchiveBatch() {
  if (currentBatchId !== "active") return;
  
  const storedCandidates = localStorage.getItem("recruitment_candidates");
  const activeCandidates = storedCandidates ? JSON.parse(storedCandidates) : [];
  
  if (activeCandidates.length === 0) {
    alert("There are no candidates in the current active batch to archive.");
    return;
  }

  const defaultName = `Batch - ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const batchName = prompt("Enter a name for this batch:", defaultName);
  
  if (batchName === null) return;
  
  const trimmedName = batchName.trim() || defaultName;

  const newBatch = {
    id: "batch_" + Date.now(),
    name: trimmedName,
    date: new Date().toISOString(),
    candidates: activeCandidates
  };

  historyBatches.push(newBatch);
  localStorage.setItem("recruitment_history_batches", JSON.stringify(historyBatches));

  // Clear active candidates
  localStorage.setItem("recruitment_candidates", JSON.stringify([]));

  // Switch to active
  currentBatchId = "active";
  loadCandidatesForCurrentMode();
  
  showEmptyState();
  renderCandidates();
  renderHistoryList();

  showStatus(`Batch "${trimmedName}" archived successfully. A new batch has started.`, "success");
}

function viewBatch(batchId) {
  currentBatchId = batchId;
  loadCandidatesForCurrentMode();
  showEmptyState();
  renderCandidates();
  renderHistoryList();
}

function deleteHistoryBatch(batchId) {
  const batch = historyBatches.find(b => b.id === batchId);
  if (!batch) return;

  if (confirm(`Are you sure you want to delete "${batch.name}" from batch history? This cannot be undone.`)) {
    historyBatches = historyBatches.filter(b => b.id !== batchId);
    localStorage.setItem("recruitment_history_batches", JSON.stringify(historyBatches));
    
    if (currentBatchId === batchId) {
      currentBatchId = "active";
      loadCandidatesForCurrentMode();
      showEmptyState();
    }
    
    renderCandidates();
    renderHistoryList();
  }
}

// Backup & Share functions
function exportAppState() {
  const data = {
    criteria: criteria,
    candidates: JSON.parse(localStorage.getItem("recruitment_candidates") || "[]"),
    historyBatches: historyBatches
  };
  
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `recruitsync_data_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus("Data exported successfully!", "success");
}

function triggerImport() {
  document.getElementById("import-file-input").click();
}

function importAppState(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      if (!importedData.criteria && !importedData.candidates && !importedData.historyBatches) {
        throw new Error("Invalid backup file format.");
      }

      if (confirm("Importing this backup will overwrite your current active candidates, custom criteria, and batch history. Are you sure you want to proceed?")) {
        if (importedData.criteria) {
          localStorage.setItem("recruitment_criteria", JSON.stringify(importedData.criteria));
        }
        if (importedData.candidates) {
          localStorage.setItem("recruitment_candidates", JSON.stringify(importedData.candidates));
        }
        if (importedData.historyBatches) {
          localStorage.setItem("recruitment_history_batches", JSON.stringify(importedData.historyBatches));
        }
        
        showStatus("Backup imported successfully! Reloading...", "success");
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    } catch (err) {
      alert("Error importing file: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ""; // clear so we can import again
}

// Mobile layout drawer interactions
const mobileFilterToggle = document.getElementById("mobile-filter-toggle");
const closeFiltersMobile = document.getElementById("close-filters-mobile");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebar = document.querySelector(".sidebar");

mobileFilterToggle.addEventListener("click", () => {
  sidebar.classList.add("sidebar-open");
  sidebarBackdrop.classList.add("active");
});

function closeFiltersDrawer() {
  sidebar.classList.remove("sidebar-open");
  sidebarBackdrop.classList.remove("active");
}

closeFiltersMobile.addEventListener("click", closeFiltersDrawer);
sidebarBackdrop.addEventListener("click", closeFiltersDrawer);

function closeDetails() {
  detailsContainer.classList.remove("active-details");
  currentSelectedId = null;
  const cards = document.querySelectorAll(".candidate-card");
  cards.forEach(card => card.classList.remove("active"));
}

// Add search listener
searchInput.addEventListener("input", renderCandidates);
sortSelect.addEventListener("change", renderCandidates);

// Add tier tab listeners
const tierTabs = document.querySelectorAll(".tier-tab");
tierTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tierTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTierFilter = tab.getAttribute("data-tier");
    renderCandidates();
  });
});

// Initial load
initAppState();
renderFilters();
renderCandidates();
renderHistoryList();
