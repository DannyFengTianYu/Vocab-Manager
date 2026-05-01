// --- Theme Manager ---
const themeSelect = document.getElementById('theme-select');
const htmlTag = document.documentElement;

function initTheme() {
    const savedTheme = localStorage.getItem('vocab-theme') || 'system';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        localStorage.setItem('vocab-theme', theme);
        applyTheme(theme);
    });
}

function applyTheme(theme) {
    htmlTag.setAttribute('data-theme', theme);
}

// --- Toast Notification ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'danger' ? ' danger' : '');
    toast.textContent = message;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// --- Navigation ---
const navBtns = document.querySelectorAll('.nav-btn');
const viewSections = document.querySelectorAll('.view-section');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        
        if (targetId === 'add-view' && editingWordId) {
            // Navigating away from edit via nav: treat as ESC (save draft)
            cancelEdit({ saveDraft: true });
        }

        // Update View
        viewSections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(targetId).classList.add('active');
        
        // Update Nav
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (targetId === 'dict-view') {
            renderDictionary();
        } else if (targetId === 'review-view') {
            // If a review session is in progress, restore state; otherwise init fresh
            if (reviewQueue.length > 0 && currentReviewIndex < reviewQueue.length) {
                // Restore the in-progress card view
                setReviewState(reviewCardView);
                updateReviewProgress();
            } else if (reviewQueue.length > 0 && currentReviewIndex >= reviewQueue.length) {
                // Session finished already
                setReviewState(reviewDoneView);
            } else {
                initReviewSession();
            }
        }
    });
});

// --- Dynamic Form Logic ---
const addDefBtn = document.getElementById('add-definition-btn');
const defsContainer = document.getElementById('definitions-container');
const defTemplate = document.getElementById('def-template');
const exampleTemplate = document.getElementById('example-template');
const addWordForm = document.getElementById('add-word-form');
const formTagOptions = document.getElementById('form-tag-options');
const formNewTagInput = document.getElementById('form-new-tag-input');
const formAddTagBtn = document.getElementById('form-add-tag-btn');
const formShowTagInputBtn = document.getElementById('form-show-tag-input-btn');
const selectedTagsContainer = document.getElementById('selected-tags');
const filterTagOptions = document.getElementById('filter-tag-options');
const filterNewTagInput = document.getElementById('filter-new-tag-input');
const filterAddTagBtn = document.getElementById('filter-add-tag-btn');
const filterShowTagInputBtn = document.getElementById('filter-show-tag-input-btn');

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// Add a new Definition
addDefBtn.addEventListener('click', () => {
    addDefinitionBlock();
});

function addDefinitionBlock() {
    const fragment = defTemplate.content.cloneNode(true);
    const defBlock = fragment.querySelector('.definition-block');
    
    const defInput = defBlock.querySelector('.def-input');
    defInput.addEventListener('input', () => autoResizeTextarea(defInput));

    // Remove functionality
    defBlock.querySelector('.remove-def').addEventListener('click', () => {
        defBlock.remove();
    });

    // Add example functionality
    const examplesContainer = defBlock.querySelector('.examples-container');
    defBlock.querySelector('.add-example-btn').addEventListener('click', () => {
        addExampleBlock(examplesContainer);
    });

    defsContainer.appendChild(defBlock);
}

function addExampleBlock(container) {
    const fragment = exampleTemplate.content.cloneNode(true);
    const exampleBlock = fragment.querySelector('.example-block');
    const exampleInput = exampleBlock.querySelector('.example-input');

    exampleInput.addEventListener('input', () => autoResizeTextarea(exampleInput));
    requestAnimationFrame(() => autoResizeTextarea(exampleInput));
    
    exampleBlock.querySelector('.remove-example').addEventListener('click', () => {
        exampleBlock.remove();
    });

    container.appendChild(exampleBlock);
}

// Initial state: 1 empty definition
addDefinitionBlock();

// --- Data Management & Form Submission ---
let savedFormTags = new Set(JSON.parse(localStorage.getItem('vocab-last-form-tags') || '[]'));
let selectedFormTags = new Set(savedFormTags);
let selectedFilterTags = new Set();
let customTags = new Set();
let cachedVocab = [];
let renamingTag = null;

async function saveCustomTags() {
    localStorage.setItem('vocab-custom-tags', JSON.stringify(Array.from(customTags)));
    try {
        const response = await fetch('/api/custom-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Array.from(customTags))
        });
        if (!response.ok) {
            console.error('Failed to sync custom tags to server', response.status);
        }
    } catch (e) {
        console.error('Failed to sync custom tags to server', e);
    }
}

async function initCustomTagsRegistry() {
    customTags.clear();
    for (const t of JSON.parse(localStorage.getItem('vocab-custom-tags') || '[]')) {
        const n = normalizeTag(t);
        if (n) customTags.add(n);
    }
    try {
        const response = await fetch('/api/custom-tags');
        if (response.ok) {
            const arr = await response.json();
            if (Array.isArray(arr)) {
                arr.forEach(t => {
                    const n = normalizeTag(t);
                    if (n) customTags.add(n);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load custom tags from server', e);
    }
    await saveCustomTags();
}

function normalizeTag(tag) {
    return (tag || '').trim();
}

function normalizeWordItem(item) {
    const tags = Array.isArray(item.tags)
        ? item.tags.map(normalizeTag).filter(Boolean)
        : [];
    return {
        ...item,
        tags: Array.from(new Set(tags))
    };
}

function getAllAvailableTags(vocab) {
    const set = new Set(customTags);
    vocab.forEach(item => {
        (item.tags || []).forEach(tag => set.add(tag));
    });
    selectedFormTags.forEach(tag => set.add(tag));
    selectedFilterTags.forEach(tag => set.add(tag));

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function getTagUsageCounts(vocab) {
    const counts = {};
    vocab.forEach(item => {
        const uniqueTags = new Set(item.tags || []);
        uniqueTags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });
    return counts;
}

function renderSelectedFormTags() {
    if (!selectedTagsContainer) return;
    const tags = Array.from(selectedFormTags);
    if (tags.length === 0) {
        selectedTagsContainer.innerHTML = '<span class="tag-empty">No tags selected.</span>';
        return;
    }

    selectedTagsContainer.innerHTML = tags
        .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
        .join('');
}

function getTagMultiSelectUiState(tag, vocab) {
    const idsWithTag = [];
    for (const item of vocab) {
        if ((item.tags || []).includes(tag)) idsWithTag.push(String(item.id));
    }
    if (idsWithTag.length === 0) return { checked: false, indeterminate: false };
    let n = 0;
    for (const id of idsWithTag) {
        if (multiSelectedIds.has(id)) n++;
    }
    if (n === 0) return { checked: false, indeterminate: false };
    if (n === idsWithTag.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
}

function renderTagOptions(container, tags, selectedSet, inputName, counts = {}, options = {}) {
    if (!container) return;
    container.innerHTML = '';
    const showCount = options.showCount !== false;
    const showDelete = options.showDelete !== false;
    const showRename = !!options.showRename;
    const compact = !!options.compact;
    const useButtons = !!options.useButtons;
    const tagFilterMultiSelect = !!options.tagFilterMultiSelect;
    const tagMultiSelectVocab = options.tagMultiSelectVocab;
    container.classList.toggle('compact-tag-options', compact);

    if (tags.length === 0) {
        container.innerHTML = '<div class="tag-empty">No tags yet. Create one below.</div>';
        return;
    }

    tags.forEach(tag => {
        // --- Button pill mode (for form tag selection) ---
        if (useButtons) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tag-pill-btn' + (selectedSet.has(tag) ? ' selected' : '');
            btn.textContent = tag;
            btn.setAttribute('data-tag-toggle', tag);
            container.appendChild(btn);
            return;
        }

        // --- Checkbox mode (for filter sidebar) ---
        const label = document.createElement('label');
        label.className = 'tag-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = inputName;
        checkbox.value = tag;
        if (tagFilterMultiSelect && Array.isArray(tagMultiSelectVocab)) {
            const st = getTagMultiSelectUiState(tag, tagMultiSelectVocab);
            checkbox.checked = st.checked;
            requestAnimationFrame(() => {
                checkbox.indeterminate = st.indeterminate;
            });
        } else {
            checkbox.checked = selectedSet.has(tag);
        }

        const isRenaming = showRename && renamingTag === tag;
        const text = document.createElement('span');
        text.textContent = tag;

        let count = null;
        let deleteBtn = null;
        let renameBtn = null;
        if (showCount && !isRenaming) {
            count = document.createElement('span');
            count.className = 'tag-count';
            count.textContent = `(${counts[tag] || 0})`;
        }
        if (showDelete) {
            deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'tag-delete-btn';
            deleteBtn.setAttribute('data-tag-delete', tag);
            deleteBtn.title = `Delete tag "${tag}"`;
            deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; margin: 0;">delete</span>';
        }
        if (showRename && !isRenaming) {
            renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'tag-rename-btn';
            renameBtn.setAttribute('data-tag-rename', tag);
            renameBtn.title = `Rename tag "${tag}"`;
            renameBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; margin: 0;">edit</span>';
        }
        if (showDelete && isRenaming) {
            deleteBtn = null;
        }

        label.appendChild(checkbox);
        if (isRenaming) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = tag;
            input.className = 'tag-rename-input';
            input.setAttribute('data-tag-rename-input', tag);
            input.autocomplete = 'off';

            label.appendChild(input);
        } else {
            label.appendChild(text);
        }
        if (count) label.appendChild(count);
        if (renameBtn) label.appendChild(renameBtn);
        if (deleteBtn) label.appendChild(deleteBtn);
        container.appendChild(label);
    });

    if (showRename && renamingTag) {
        const activeInput = container.querySelector(`[data-tag-rename-input="${CSS.escape(renamingTag)}"]`);
        if (activeInput instanceof HTMLInputElement) {
            activeInput.focus();
            activeInput.select();
        }
    }
}

function renderTagPanels(vocab) {
    const tags = getAllAvailableTags(vocab);
    const counts = getTagUsageCounts(vocab);
    renderTagOptions(formTagOptions, tags, selectedFormTags, 'form-tags', counts, {
        showCount: false,
        showDelete: false,
        compact: true,
        useButtons: true
    });
    renderTagOptions(filterTagOptions, tags, selectedFilterTags, 'filter-tags', counts, {
        showCount: true,
        showDelete: true,
        showRename: true,
        compact: false,
        tagFilterMultiSelect: multiSelectMode,
        tagMultiSelectVocab: vocab
    });
    renderSelectedFormTags();
}

async function getVocabData() {
    try {
        const response = await fetch('/api/vocab');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error("Failed to fetch vocab data", e);
    }
    return [];
}

async function saveVocabData(data) {
    try {
        await fetch('/api/vocab', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Failed to save vocab data", e);
        showToast('Error saving data!');
    }
}

let editingWordId = null;
const EDIT_DRAFT_KEY = 'vocab-edit-draft';

// --- Edit Draft Cache Helpers ---
function saveEditDraft() {
    if (!editingWordId) return;
    const wordInput = document.getElementById('word-input').value;
    const defBlocks = defsContainer.querySelectorAll('.definition-block');
    const definitions = [];
    defBlocks.forEach(defBlock => {
        const pos = defBlock.querySelector('.def-pos').value;
        const meaning = defBlock.querySelector('.def-input').value;
        const exampleInputs = defBlock.querySelectorAll('.example-input');
        const examples = Array.from(exampleInputs).map(input => input.value);
        definitions.push({ pos, meaning, examples });
    });
    const draft = {
        wordId: editingWordId,
        word: wordInput,
        tags: Array.from(selectedFormTags),
        definitions
    };
    sessionStorage.setItem(EDIT_DRAFT_KEY, JSON.stringify(draft));
}

function loadEditDraft(wordId) {
    try {
        const raw = sessionStorage.getItem(EDIT_DRAFT_KEY);
        if (!raw) return null;
        const draft = JSON.parse(raw);
        if (draft && draft.wordId === wordId) return draft;
    } catch (e) { /* ignore */ }
    return null;
}

function clearEditDraft() {
    sessionStorage.removeItem(EDIT_DRAFT_KEY);
}

addWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const wordInput = document.getElementById('word-input').value.trim();
    if (!wordInput) return;

    let vocab = await getVocabData();
    const wasEditing = !!editingWordId;
    const existingWord = wasEditing ? vocab.find(item => item.id === editingWordId) : null;

    const wordData = {
        id: editingWordId || Date.now().toString(),
        word: wordInput,
        timestamp: existingWord?.timestamp || Date.now(),
        tags: Array.from(selectedFormTags),
        definitions: []
    };

    const defBlocks = defsContainer.querySelectorAll('.definition-block');
    defBlocks.forEach(defBlock => {
        const defText = defBlock.querySelector('.def-input').value.trim();
        const defPos = defBlock.querySelector('.def-pos').value;
        
        const exampleInputs = defBlock.querySelectorAll('.example-input');
        const examples = Array.from(exampleInputs)
                            .map(input => input.value.trim())
                            .filter(val => val !== '');
        
        // Only save block if meaning or examples are provided
        if (defText || examples.length > 0) {
            wordData.definitions.push({
                pos: defPos,
                meaning: defText,
                examples: examples
            });
        }
    });

    // Save to server
    if (wasEditing) {
        vocab = vocab.map(item => item.id === editingWordId ? wordData : item);
        clearEditDraft(); // Saved successfully, clear any draft
        showToast('Word updated successfully!');
    } else {
        vocab.unshift(wordData);
        showToast('Word added successfully!');
        // Remember selected tags for next add
        savedFormTags = new Set(selectedFormTags);
        localStorage.setItem('vocab-last-form-tags', JSON.stringify(Array.from(savedFormTags)));
    }
    await saveVocabData(vocab);

    await resetFormState();

    if (wasEditing) {
        renderDictionary((document.getElementById('search-input').value || '').toLowerCase().trim());
    }
});


// --- Dictionary View ---
const searchInput = document.getElementById('search-input');
const wordListContainer = document.getElementById('word-list');
const sortModeSelect = document.getElementById('sort-mode-select');
const sortOrderBtn = document.getElementById('sort-order-btn');
const dictMultiSelectBtn = document.getElementById('dict-multi-select-btn');
const dictBulkBar = document.getElementById('dict-bulk-bar');
const dictBulkCount = document.getElementById('dict-bulk-count');
const dictBulkTagSelect = document.getElementById('dict-bulk-tag-select');
const dictBulkCopyBtn = document.getElementById('dict-bulk-copy-btn');
const dictBulkMoveBtn = document.getElementById('dict-bulk-move-btn');
const dictBulkCancelBtn = document.getElementById('dict-bulk-cancel-btn');
let sortMode = 'timestamp';
let sortOrder = 'desc';
let multiSelectMode = false;
let multiSelectedIds = new Set();

function exitMultiSelectMode() {
    if (!multiSelectMode) return;
    multiSelectMode = false;
    multiSelectedIds.clear();
    selectedFilterTags.clear();
    if (dictBulkTagSelect) dictBulkTagSelect.value = '';
    void renderDictionary((searchInput.value || '').toLowerCase().trim());
}

function toggleMultiSelectMode() {
    if (multiSelectMode) {
        exitMultiSelectMode();
    } else {
        multiSelectMode = true;
        void (async () => {
            await renderDictionary((searchInput.value || '').toLowerCase().trim());
            if (!wordListContainer || !multiSelectMode) return;
            wordListContainer.classList.remove('word-list--multi-enter');
            void wordListContainer.offsetWidth;
            wordListContainer.classList.add('word-list--multi-enter');
            setTimeout(() => wordListContainer.classList.remove('word-list--multi-enter'), 1100);
        })();
    }
}

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    renderDictionary(query);
});

sortModeSelect.addEventListener('change', (e) => {
    sortMode = e.target.value;
    renderDictionary((searchInput.value || '').toLowerCase().trim());
});

sortOrderBtn.addEventListener('click', () => {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    sortOrderBtn.textContent = sortOrder === 'asc' ? '↑' : '↓';
    sortOrderBtn.title = sortOrder === 'asc' ? 'Ascending order' : 'Descending order';
    sortOrderBtn.setAttribute('aria-label', sortOrderBtn.title);
    renderDictionary((searchInput.value || '').toLowerCase().trim());
});

dictMultiSelectBtn?.addEventListener('click', () => {
    toggleMultiSelectMode();
});

wordListContainer.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains('word-select-cb')) return;
    const id = t.getAttribute('data-word-id');
    if (!id) return;
    if (t.checked) multiSelectedIds.add(id);
    else multiSelectedIds.delete(id);
    updateBulkBarCount();
    if (multiSelectMode && cachedVocab.length > 0) {
        renderTagPanels(cachedVocab);
    }
});

dictBulkCopyBtn?.addEventListener('click', () => void bulkApplyTag('copy'));
dictBulkMoveBtn?.addEventListener('click', () => void bulkApplyTag('move'));
dictBulkCancelBtn?.addEventListener('click', () => exitMultiSelectMode());

if (formTagOptions) {
    formTagOptions.addEventListener('click', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        // Handle tag pill button toggle
        const toggleBtn = target.closest('[data-tag-toggle]');
        if (toggleBtn) {
            const tag = normalizeTag(toggleBtn.getAttribute('data-tag-toggle'));
            if (!tag) return;
            if (selectedFormTags.has(tag)) {
                selectedFormTags.delete(tag);
                toggleBtn.classList.remove('selected');
            } else {
                selectedFormTags.add(tag);
                toggleBtn.classList.add('selected');
            }
            renderSelectedFormTags();
            return;
        }

        // Handle delete button (safety guard, form tags don't show delete)
        const deleteTarget = target.closest('[data-tag-delete]');
        if (!deleteTarget) return;
        e.preventDefault();
        e.stopPropagation();
        await deleteTagEverywhere(deleteTarget.getAttribute('data-tag-delete'));
    });
}

if (filterTagOptions) {
    filterTagOptions.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
        const tag = normalizeTag(target.value);
        if (!tag) return;

        if (multiSelectMode) {
            const idsWithTag = cachedVocab
                .filter(item => (item.tags || []).includes(tag))
                .map(item => String(item.id));
            if (target.checked) {
                idsWithTag.forEach(id => multiSelectedIds.add(id));
            } else {
                idsWithTag.forEach(id => multiSelectedIds.delete(id));
            }
            void renderDictionary((searchInput.value || '').toLowerCase().trim());
            return;
        }

        if (target.checked) {
            selectedFilterTags.add(tag);
        } else {
            selectedFilterTags.delete(tag);
        }
        renderDictionary((searchInput.value || '').toLowerCase().trim());
    });
    filterTagOptions.addEventListener('click', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const renameTarget = target.closest('[data-tag-rename]');
        if (renameTarget) {
            e.preventDefault();
            e.stopPropagation();
            renamingTag = renameTarget.getAttribute('data-tag-rename');
            renderDictionary((searchInput.value || '').toLowerCase().trim());
            return;
        }
        const deleteTarget = target.closest('[data-tag-delete]');
        if (!deleteTarget) return;
        e.preventDefault();
        e.stopPropagation();
        await deleteTagEverywhere(deleteTarget.getAttribute('data-tag-delete'));
    });
    filterTagOptions.addEventListener('keydown', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        const oldTag = target.getAttribute('data-tag-rename-input');
        if (!oldTag) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            await renameTagEverywhere(oldTag);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            renamingTag = null;
            renderDictionary((searchInput.value || '').toLowerCase().trim());
        }
    });
}


function createCustomTag(rawValue, addToFormSelection = false, addToFilterSelection = false) {
    const tag = normalizeTag(rawValue);
    if (!tag) return;

    customTags.add(tag);
    void saveCustomTags();
    if (addToFormSelection) selectedFormTags.add(tag);
    if (addToFilterSelection) selectedFilterTags.add(tag);
    renderDictionary((searchInput.value || '').toLowerCase().trim());
}

async function deleteTagEverywhere(rawTag) {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    if (!confirm(`Delete tag "${tag}" from all words?`)) return;

    const vocab = (await getVocabData()).map(normalizeWordItem);
    const updated = vocab.map(item => ({
        ...item,
        tags: (item.tags || []).filter(t => t !== tag)
    }));

    customTags.delete(tag);
    selectedFormTags.delete(tag);
    selectedFilterTags.delete(tag);
    await saveCustomTags();
    await saveVocabData(updated);
    renderDictionary((searchInput.value || '').toLowerCase().trim());
}

async function renameTagEverywhere(rawTag) {
    const oldTag = normalizeTag(rawTag);
    if (!oldTag) {
        renamingTag = null;
        renderDictionary((searchInput.value || '').toLowerCase().trim());
        return;
    }
    const renameInput = filterTagOptions?.querySelector(`[data-tag-rename-input="${CSS.escape(oldTag)}"]`);
    if (!(renameInput instanceof HTMLInputElement)) {
        renamingTag = null;
        renderDictionary((searchInput.value || '').toLowerCase().trim());
        return;
    }

    const newTag = normalizeTag(renameInput.value);
    if (!newTag) {
        renamingTag = null;
        showToast('Tag name cannot be empty. Kept original tag.');
        renderDictionary((searchInput.value || '').toLowerCase().trim());
        return;
    }
    if (newTag === oldTag) {
        renamingTag = null;
        renderDictionary((searchInput.value || '').toLowerCase().trim());
        return;
    }

    const vocab = (await getVocabData()).map(normalizeWordItem);
    const updated = vocab.map(item => {
        const replaced = (item.tags || []).map(tag => (tag === oldTag ? newTag : tag));
        return {
            ...item,
            tags: Array.from(new Set(replaced))
        };
    });

    customTags.delete(oldTag);
    customTags.add(newTag);
    if (selectedFormTags.has(oldTag)) {
        selectedFormTags.delete(oldTag);
        selectedFormTags.add(newTag);
    }
    if (selectedFilterTags.has(oldTag)) {
        selectedFilterTags.delete(oldTag);
        selectedFilterTags.add(newTag);
    }

    await saveCustomTags();
    await saveVocabData(updated);
    renamingTag = null;
    renderDictionary((searchInput.value || '').toLowerCase().trim());
}

function commitAddTagInput(input, addToForm, addToFilter) {
    if (!input) return;
    const wrapper = input.parentElement;
    if (!wrapper || wrapper.classList.contains('hidden')) return;
    if (input.value.trim()) {
        createCustomTag(input.value, addToForm, addToFilter);
    }
    input.value = '';
    wrapper.classList.add('hidden');
}

document.addEventListener('pointerdown', async (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;

    // --- Handle tag rename commit on outside click ---
    if (renamingTag) {
        if (filterTagOptions && filterTagOptions.contains(target)) return;
        if (target instanceof HTMLElement && target.closest('[data-tag-rename]')) return;
        await renameTagEverywhere(renamingTag);
        return;
    }

    // --- Handle add-tag input: hide (and save) when clicking outside ---
    const formWrapper = formNewTagInput?.parentElement;
    if (formWrapper && !formWrapper.classList.contains('hidden')) {
        const clickedInsideForm = formWrapper.contains(target) || (target instanceof HTMLElement && target.closest('#form-show-tag-input-btn'));
        if (!clickedInsideForm) {
            commitAddTagInput(formNewTagInput, true, false);
        }
    }

    const filterWrapper = filterNewTagInput?.parentElement;
    if (filterWrapper && !filterWrapper.classList.contains('hidden')) {
        const clickedInsideFilter = filterWrapper.contains(target) || (target instanceof HTMLElement && target.closest('#filter-show-tag-input-btn'));
        if (!clickedInsideFilter) {
            commitAddTagInput(filterNewTagInput, false, true);
        }
    }
});

if (formAddTagBtn) {
    formAddTagBtn.addEventListener('click', () => {
        createCustomTag(formNewTagInput.value, true, false);
        formNewTagInput.value = '';
        formNewTagInput.parentElement?.classList.add('hidden');
    });
}
if (formShowTagInputBtn) {
    formShowTagInputBtn.addEventListener('click', () => {
        formNewTagInput.parentElement?.classList.remove('hidden');
        formNewTagInput.focus();
    });
}
if (formNewTagInput) {
    formNewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            formAddTagBtn.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            formNewTagInput.value = '';
            formNewTagInput.parentElement?.classList.add('hidden');
        }
    });
}

if (filterAddTagBtn) {
    filterAddTagBtn.addEventListener('click', () => {
        createCustomTag(filterNewTagInput.value, false, true);
        filterNewTagInput.value = '';
        filterNewTagInput.parentElement?.classList.add('hidden');
    });
}
if (filterShowTagInputBtn) {
    filterShowTagInputBtn.addEventListener('click', () => {
        filterNewTagInput.parentElement?.classList.remove('hidden');
        filterNewTagInput.focus();
    });
}
if (filterNewTagInput) {
    filterNewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterAddTagBtn.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            filterNewTagInput.value = '';
            filterNewTagInput.parentElement?.classList.add('hidden');
        }
    });
}

formNewTagInput?.parentElement?.classList.add('hidden');
filterNewTagInput?.parentElement?.classList.add('hidden');

function sortVocabList(list) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        if (sortMode === 'alphabet') {
            const compare = (a.word || '').localeCompare((b.word || ''), undefined, { sensitivity: 'base' });
            return compare * direction;
        }

        const timeA = Number(a.timestamp) || 0;
        const timeB = Number(b.timestamp) || 0;
        if (timeA === timeB) return 0;
        return (timeA - timeB) * direction;
    });
}

function updateBulkBarCount() {
    if (!dictBulkCount) return;
    const n = multiSelectedIds.size;
    dictBulkCount.textContent = n === 1 ? '1 word selected' : `${n} words selected`;
}

function populateBulkTagSelect() {
    if (!dictBulkTagSelect) return;
    const tags = getAllAvailableTags(cachedVocab);
    const previous = dictBulkTagSelect.value;
    dictBulkTagSelect.innerHTML = '<option value="">— Pick tag —</option>';
    tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        dictBulkTagSelect.appendChild(opt);
    });
    if (previous && tags.includes(previous)) dictBulkTagSelect.value = previous;
}

function refreshMultiSelectUi() {
    const dictView = document.getElementById('dict-view');
    dictView?.classList.toggle('multi-select-active', multiSelectMode);
    wordListContainer?.classList.toggle('word-list--multi', multiSelectMode);
    if (!multiSelectMode) {
        wordListContainer?.classList.remove('word-list--multi-enter');
    }
    dictMultiSelectBtn?.classList.toggle('active', multiSelectMode);
    if (dictMultiSelectBtn) {
        dictMultiSelectBtn.textContent = multiSelectMode ? '\u2611' : '\u2610';
        dictMultiSelectBtn.setAttribute('aria-pressed', multiSelectMode ? 'true' : 'false');
    }
    if (dictBulkBar) {
        dictBulkBar.classList.toggle('hidden', !multiSelectMode);
        dictBulkBar.setAttribute('aria-hidden', multiSelectMode ? 'false' : 'true');
    }
    populateBulkTagSelect();
    updateBulkBarCount();
}

function runBulkSuccessFlash(ids) {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    if (idSet.size === 0) return;
    requestAnimationFrame(() => {
        wordListContainer.querySelectorAll('.word-card').forEach(el => {
            const id = el.getAttribute('data-id');
            if (id == null || !idSet.has(String(id))) return;
            el.classList.remove('word-card--bulk-flash');
            void el.offsetWidth;
            el.classList.add('word-card--bulk-flash');
            setTimeout(() => el.classList.remove('word-card--bulk-flash'), 750);
        });
    });
}

function resolveBulkTargetTag() {
    return normalizeTag(dictBulkTagSelect?.value);
}

async function bulkApplyTag(mode) {
    const tag = resolveBulkTargetTag();
    if (!tag) {
        showToast('Pick a tag.');
        return;
    }
    if (multiSelectedIds.size === 0) {
        showToast('Select at least one word.');
        return;
    }
    if (mode === 'move') {
        const ok = confirm(`Replace all tags on ${multiSelectedIds.size} word(s) with only "${tag}"?`);
        if (!ok) return;
    }
    const triggerBtn = mode === 'copy' ? dictBulkCopyBtn : dictBulkMoveBtn;
    triggerBtn?.classList.add('is-working');
    const idsToFlash = new Set(multiSelectedIds);
    try {
        let vocab = (await getVocabData()).map(normalizeWordItem);
        const idSet = multiSelectedIds;
        customTags.add(tag);
        void saveCustomTags();
        vocab = vocab.map(item => {
            if (!idSet.has(String(item.id))) return item;
            if (mode === 'copy') {
                const next = new Set(item.tags || []);
                next.add(tag);
                return { ...item, tags: Array.from(next) };
            }
            return { ...item, tags: [tag] };
        });
        await saveVocabData(vocab);
        const n = idSet.size;
        showToast(mode === 'copy' ? `Added tag to ${n} word(s).` : `Moved ${n} word(s) to "${tag}".`);
        await renderDictionary((searchInput.value || '').toLowerCase().trim());
        runBulkSuccessFlash(idsToFlash);
    } finally {
        triggerBtn?.classList.remove('is-working');
    }
}

async function renderDictionary(searchQuery = '') {
    const vocab = (await getVocabData()).map(normalizeWordItem);
    cachedVocab = vocab;
    renderTagPanels(vocab);
    wordListContainer.innerHTML = '';

    const filteredVocab = vocab.filter(item => {
        if (!multiSelectMode && selectedFilterTags.size > 0) {
            const wordTags = new Set(item.tags || []);
            const hasAnySelectedTag = Array.from(selectedFilterTags).some(tag => wordTags.has(tag));
            if (!hasAnySelectedTag) return false;
        }

        if (!searchQuery) return true;
        // Search in word
        if (item.word.toLowerCase().includes(searchQuery)) return true;
        // Search in tags
        if ((item.tags || []).some(tag => tag.toLowerCase().includes(searchQuery))) return true;
        // Search in meanings
        for (const def of (item.definitions || [])) {
            if (def.meaning && def.meaning.toLowerCase().includes(searchQuery)) return true;
            for (const ex of (def.examples || [])) {
                if (ex.toLowerCase().includes(searchQuery)) return true;
            }
        }
        return false;
    });
    const sortedVocab = sortVocabList(filteredVocab);

    if (sortedVocab.length === 0) {
        wordListContainer.innerHTML = `<div class="empty-state">
            ${searchQuery ? 'No words match your search.' : 'Your dictionary is empty. Start adding some words!'}
        </div>`;
        refreshMultiSelectUi();
        requestAnimationFrame(adjustSidebarHeight);
        return;
    }

    sortedVocab.forEach((item, cardIndex) => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.setAttribute('data-id', item.id);
        if (multiSelectMode) {
            card.style.setProperty('--ms-stagger', `${Math.min(cardIndex, 28) * 0.028}s`);
        }

        const wordIdKey = String(item.id);
        const selectPrefix = multiSelectMode
            ? `<label class="word-select-label"><input type="checkbox" class="word-select-cb" data-word-id="${escapeHtml(wordIdKey)}"${multiSelectedIds.has(wordIdKey) ? ' checked' : ''}></label>`
            : '';

        let definitionsHtml = '';
        if (item.definitions && item.definitions.length > 0) {
            definitionsHtml = `<div class="word-definitions">`;
            item.definitions.forEach(def => {
                let examplesHtml = '';
                if (def.examples && def.examples.length > 0) {
                    examplesHtml = `<ul class="word-examples">
                        ${def.examples.map(ex => `<li class="word-example-item">${escapeHtml(ex)}</li>`).join('')}
                    </ul>`;
                }
                
                definitionsHtml += `
                    <div class="word-def-item">
                        ${def.meaning ? `<div class="word-def-text">${def.pos ? `<strong>${escapeHtml(def.pos)}</strong> ` : ''}${escapeHtml(def.meaning)}</div>` : ''}
                        ${examplesHtml}
                    </div>
                `;
            });
            definitionsHtml += `</div>`;
        } else {
            definitionsHtml = `<div class="word-definitions"><div style="color: var(--text-secondary); font-style: italic;">No definitions provided.</div></div>`;
        }

        const addedDateHtml = item.timestamp
            ? `<div class="word-added-date">Added on ${escapeHtml(formatTimestamp(item.timestamp))}</div>`
            : '';
        const tagsHtml = (item.tags && item.tags.length > 0)
            ? `<div class="word-tags">${item.tags.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>`
            : '';

        card.innerHTML = `
            <div class="word-card-row">
                ${selectPrefix}
                <div class="word-card-main">
                    <div class="word-header" style="margin-bottom: 0;">
                        <div class="word-title">${escapeHtml(item.word)}</div>
                        <div class="word-actions">
                            <button class="edit-word-btn" title="Edit word">Edit</button>
                            <button class="delete-word-btn" title="Delete word">Delete</button>
                        </div>
                    </div>
                    <div class="word-details">
                        ${tagsHtml}
                        ${definitionsHtml}
                        ${addedDateHtml}
                    </div>
                </div>
            </div>
        `;

        const headerEl = card.querySelector('.word-header');
        const detailsEl = card.querySelector('.word-details');
        if (detailsEl) {
            detailsEl.style.maxHeight = '0px';
            detailsEl.style.opacity = '0';
        }

        // Toggle expansion
        headerEl.addEventListener('click', () => {
            const isExpanded = card.classList.toggle('expanded');
            if (!detailsEl) return;

            if (isExpanded) {
                detailsEl.style.maxHeight = `${detailsEl.scrollHeight}px`;
                detailsEl.style.opacity = '1';
            } else {
                detailsEl.style.maxHeight = `${detailsEl.scrollHeight}px`;
                requestAnimationFrame(() => {
                    detailsEl.style.maxHeight = '0px';
                    detailsEl.style.opacity = '0';
                });
            }
        });

        // Attach delete event directly
        const deleteBtn = card.querySelector('.delete-word-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${item.word}"?`)) {
                deleteWord(item.id);
            }
        });

        // Attach edit event directly
        const editBtn = card.querySelector('.edit-word-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (editingWordId && editingWordId !== item.id) {
                // Editing a different word: clear draft of previous word
                clearEditDraft();
                cancelEdit({ saveDraft: false });
            }
            editWord(item);
        });

        wordListContainer.appendChild(card);
    });
    refreshMultiSelectUi();
    requestAnimationFrame(adjustSidebarHeight);
}

async function deleteWord(id) {
    multiSelectedIds.delete(String(id));
    let vocab = await getVocabData();
    const deleted = vocab.find(item => item.id === id);
    vocab = vocab.filter(item => item.id !== id);
    await saveVocabData(vocab);
    showToast(`"${deleted?.word || 'Word'}" deleted.`, 'danger');
    renderDictionary(searchInput.value.toLowerCase().trim());
}

const sharedFormContainer = document.getElementById('shared-form-container');
const addViewSection = document.getElementById('add-view');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editModal = document.createElement('div');
editModal.className = 'edit-modal';
editModal.innerHTML = `<div class="edit-modal-panel"></div>`;
document.body.appendChild(editModal);
const editModalPanel = editModal.querySelector('.edit-modal-panel');

// Clicking modal backdrop: save draft before exiting
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        cancelEdit({ saveDraft: true });
    }
});

function waitForModalExit() {
    return new Promise((resolve) => {
        const done = () => {
            editModal.removeEventListener('transitionend', onTransitionEnd);
            resolve();
        };
        const onTransitionEnd = (e) => {
            if (e.target === editModal) {
                done();
            }
        };
        editModal.addEventListener('transitionend', onTransitionEnd);
        setTimeout(done, 260);
    });
}

async function closeEditModal() {
    if (!editModal.classList.contains('show')) return;
    editModal.classList.add('closing');
    editModal.classList.remove('show');
    await waitForModalExit();
    editModal.classList.remove('closing');
    document.body.classList.remove('modal-open');
}

// cancelEdit with optional draft-save flag
async function cancelEdit({ saveDraft = false } = {}) {
    if (!editingWordId) return;
    if (saveDraft) {
        saveEditDraft();
    } else {
        clearEditDraft();
    }
    await resetFormState();
    renderDictionary((document.getElementById('search-input').value || '').toLowerCase().trim());
}

// Cancel button: discard draft
cancelEditBtn.addEventListener('click', () => cancelEdit({ saveDraft: false }));

// ESC: exit edit draft, or exit multi-select (dictionary)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (editingWordId !== null) {
        cancelEdit({ saveDraft: true });
        return;
    }
    if (multiSelectMode) {
        e.preventDefault();
        exitMultiSelectMode();
    }
});

async function resetFormState() {
    editingWordId = null;
    // Restore remembered tags (add memory); editing doesn't affect savedFormTags
    selectedFormTags = new Set(savedFormTags);
    await closeEditModal();
    if (sharedFormContainer && addViewSection) {
        addViewSection.appendChild(sharedFormContainer);
    }
    document.getElementById('form-title').textContent = 'Add New Word';
    document.getElementById('save-word-btn').textContent = 'Save Word';
    cancelEditBtn.style.display = 'none';
    
    addWordForm.reset();
    document.getElementById('definitions-container').innerHTML = '';
    addDefinitionBlock();
    const vocab = (await getVocabData()).map(normalizeWordItem);
    renderTagPanels(vocab);
}

function editWord(item) {
    editingWordId = item.id;

    // Check for a saved draft for this word
    const draft = loadEditDraft(item.id);
    const source = draft || item;

    selectedFormTags = new Set((source.tags || []).map(normalizeTag).filter(Boolean));
    
    // Modal edit setup
    if (editModalPanel) {
        editModalPanel.appendChild(sharedFormContainer);
        sharedFormContainer.classList.remove('edit-enter');
        void sharedFormContainer.offsetWidth;
        sharedFormContainer.classList.add('edit-enter');
        editModal.classList.remove('closing');
        editModal.classList.add('show');
        document.body.classList.add('modal-open');
    }
    
    // Update UI title and button
    document.getElementById('form-title').textContent = 'Edit Word';
    document.getElementById('save-word-btn').textContent = 'Update Word';
    cancelEditBtn.style.display = 'inline-flex';

    // Populate data (from draft if available, otherwise from saved item)
    document.getElementById('word-input').value = source.word || item.word;


    // Clear current def blocks
    defsContainer.innerHTML = '';
    
    const defsToRender = (source.definitions && source.definitions.length > 0)
        ? source.definitions
        : (item.definitions && item.definitions.length > 0 ? item.definitions : null);

    if (defsToRender) {
        defsToRender.forEach(def => {
            const fragment = defTemplate.content.cloneNode(true);
            const defBlock = fragment.querySelector('.definition-block');
            
            defBlock.querySelector('.remove-def').addEventListener('click', () => {
                defBlock.remove();
            });

            defBlock.querySelector('.def-pos').value = def.pos || '';
            const defInput = defBlock.querySelector('.def-input');
            defInput.value = def.meaning || '';
            defInput.addEventListener('input', () => autoResizeTextarea(defInput));
            requestAnimationFrame(() => autoResizeTextarea(defInput));

            const examplesContainer = defBlock.querySelector('.examples-container');
            defBlock.querySelector('.add-example-btn').addEventListener('click', () => {
                addExampleBlock(examplesContainer);
            });

            if (def.examples && def.examples.length > 0) {
                def.examples.forEach(ex => {
                    const exFragment = exampleTemplate.content.cloneNode(true);
                    const exampleBlock = exFragment.querySelector('.example-block');
                    const exampleInput = exampleBlock.querySelector('.example-input');
                    exampleInput.value = ex;
                    exampleInput.addEventListener('input', () => autoResizeTextarea(exampleInput));
                    requestAnimationFrame(() => autoResizeTextarea(exampleInput));
                    exampleBlock.querySelector('.remove-example').addEventListener('click', () => {
                        exampleBlock.remove();
                    });
                    examplesContainer.appendChild(exampleBlock);
                });
            }

            defsContainer.appendChild(defBlock);
        });
    } else {
        addDefinitionBlock();
    }

    renderSelectedFormTags();
    renderTagOptions(
        formTagOptions,
        getAllAvailableTags(cachedVocab),
        selectedFormTags,
        'form-tags',
        getTagUsageCounts(cachedVocab),
        {
            showCount: false,
            showDelete: false,
            compact: true,
            useButtons: true
        }
    );
}

// Utility to prevent XSS
function escapeHtml(unsafe) {
    return (unsafe || '').replace(/[&<"'>]/g, function (match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return match;
        }
    });
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

// --- Layout Adjustments ---
function adjustSidebarHeight() {
    const sidebar = document.querySelector('.dict-sidebar');
    if (!sidebar) return;
    
    const dictView = document.getElementById('dict-view');
    if (!dictView || !dictView.classList.contains('active')) return;
    
    const rect = sidebar.getBoundingClientRect();
    // Maintain a 1rem (16px) margin at the bottom of the viewport
    const availableHeight = window.innerHeight - rect.top - 16;
    
    if (availableHeight > 100) {
        sidebar.style.height = `${availableHeight}px`;
    }
}

window.addEventListener('scroll', adjustSidebarHeight, { passive: true });
window.addEventListener('resize', adjustSidebarHeight, { passive: true });

// --- Init ---
initTheme();
(async () => {
    await initCustomTagsRegistry();
    await renderDictionary();
})();

// --- Review (Spaced Repetition) Logic ---
let reviewQueue = [];
let currentReviewIndex = 0;

const reviewSetupView = document.getElementById('review-setup');
const reviewCardView = document.getElementById('review-card');
const reviewDoneView = document.getElementById('review-done');
const reviewSummaryText = document.getElementById('review-summary-text');
const startReviewBtn = document.getElementById('start-review-btn');
const showAnswerBtn = document.getElementById('show-answer-btn');
const flashcardBack = document.getElementById('flashcard-back');
const reviewWordDisplay = document.getElementById('review-word-display');
const reviewDefinitionsContainer = document.getElementById('review-definitions');
const reviewHomeBtn = document.getElementById('review-home-btn');

const reviewOptionsContainer = document.getElementById('review-options');
const reviewTagAllInput = document.getElementById('review-tag-all');
const reviewTagOptionsContainer = document.getElementById('review-tag-options');
const reviewLimitInput = document.getElementById('review-limit-input');

let _reviewVocab = [];

async function initReviewSession() {
    setReviewState(reviewSetupView);
    reviewSummaryText.textContent = "Loading...";
    if (reviewOptionsContainer) reviewOptionsContainer.classList.add('hidden');
    startReviewBtn.style.display = 'none';

    _reviewVocab = await getVocabData();

    const savedMode = localStorage.getItem('vocab-review-mode') || 'srs';
    const radioSrs = document.querySelector('input[name="review-mode"][value="srs"]');
    const radioRandom = document.querySelector('input[name="review-mode"][value="random"]');
    if (savedMode === 'random' && radioRandom) radioRandom.checked = true;
    else if (radioSrs) radioSrs.checked = true;

    updateReviewSummary();
    
    if (_reviewVocab.length === 0) {
        setReviewState(reviewDoneView);
    }
}

function updateReviewSummary() {
    const radioRandom = document.querySelector('input[name="review-mode"][value="random"]');
    const isRandomMode = radioRandom && radioRandom.checked;
    const now = Date.now();

    let pool = _reviewVocab;
    if (!isRandomMode) {
        pool = pool.filter(item => {
            if (!item.review_data || typeof item.review_data.next_review_date !== 'number') return true;
            return item.review_data.next_review_date <= now;
        });
    }

    if (pool.length === 0) {
        reviewSummaryText.textContent = isRandomMode ? "You have 0 words in your dictionary." : "You have 0 words due for review.";
        if (reviewOptionsContainer) reviewOptionsContainer.classList.add('hidden');
        startReviewBtn.style.display = 'none';
        window._allDueWords = [];
        return;
    }
    
    if (reviewOptionsContainer) reviewOptionsContainer.classList.remove('hidden');
    startReviewBtn.style.display = 'inline-flex';

    const dueTags = new Set();
    pool.forEach(item => {
        if (item.tags) item.tags.forEach(t => dueTags.add(t));
    });

    if (dueTags.size > 0 && reviewTagOptionsContainer) {
        let html = '';
        Array.from(dueTags).sort().forEach(tag => {
            html += `<label class="tag-option"><input type="checkbox" class="review-tag-cb" value="${escapeHtml(tag)}"> <span>${escapeHtml(tag)}</span></label>`;
        });
        reviewTagOptionsContainer.innerHTML = html;
        if (reviewTagAllInput) {
            const savedAllTags = localStorage.getItem('vocab-review-all-tags');
            if (savedAllTags === 'false') {
                reviewTagAllInput.checked = false;
                reviewTagOptionsContainer.style.display = 'flex';
            } else {
                reviewTagAllInput.checked = true;
                reviewTagOptionsContainer.style.display = 'none';
            }
            reviewTagAllInput.disabled = false;
            
            const savedTagsStr = localStorage.getItem('vocab-review-selected-tags');
            const savedTags = savedTagsStr ? JSON.parse(savedTagsStr) : [];
            
            if (savedTags.length > 0) {
                const checkboxes = reviewTagOptionsContainer.querySelectorAll('.review-tag-cb');
                checkboxes.forEach(cb => {
                    if (savedTags.includes(cb.value)) cb.checked = true;
                });
            }
        }
    } else if (reviewTagOptionsContainer) {
        reviewTagOptionsContainer.innerHTML = '<span class="tag-empty">No tags available.</span>';
        if (reviewTagAllInput) {
            reviewTagAllInput.checked = true;
            reviewTagAllInput.disabled = true;
        }
    }

    const savedLimit = localStorage.getItem('vocab-review-limit');
    if (savedLimit && reviewLimitInput) {
        reviewLimitInput.value = savedLimit;
    }

    reviewSummaryText.textContent = isRandomMode ? 
        `You have ${pool.length} word${pool.length > 1 ? 's' : ''} available for random review.` : 
        `You have ${pool.length} word${pool.length > 1 ? 's' : ''} due for review.`;

    window._allDueWords = pool;
}

document.querySelectorAll('input[name="review-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        localStorage.setItem('vocab-review-mode', radio.value);
        updateReviewSummary();
    });
});

if (reviewTagAllInput) {
    reviewTagAllInput.addEventListener('change', (e) => {
        if (e.target.checked) {
            reviewTagOptionsContainer.style.display = 'none';
        } else {
            reviewTagOptionsContainer.style.display = 'flex';
        }
    });
}

function setReviewState(stateEl) {
    [reviewSetupView, reviewCardView, reviewDoneView].forEach(el => el.classList.remove('active'));
    stateEl.classList.add('active');
}

startReviewBtn.addEventListener('click', () => {
    let allDueWords = window._allDueWords || [];
    
    // Filter by tags
    const isAllChecked = reviewTagAllInput && reviewTagAllInput.checked;
    localStorage.setItem('vocab-review-all-tags', isAllChecked ? 'true' : 'false');
    
    if (reviewTagAllInput && !isAllChecked) {
        const selectedTags = Array.from(reviewTagOptionsContainer.querySelectorAll('.review-tag-cb:checked')).map(cb => cb.value);
        localStorage.setItem('vocab-review-selected-tags', JSON.stringify(selectedTags));
        if (selectedTags.length > 0) {
            allDueWords = allDueWords.filter(item => {
                if (!item.tags || item.tags.length === 0) return false;
                return item.tags.some(tag => selectedTags.includes(tag));
            });
        } else {
            showToast('Please select at least one tag, or toggle "All Tags".', 'danger');
            return;
        }
    }

    reviewQueue = [...allDueWords];
    
    // Shuffle the queue for a random order
    for (let i = reviewQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [reviewQueue[i], reviewQueue[j]] = [reviewQueue[j], reviewQueue[i]];
    }

    // Apply limit
    let limitStr = reviewLimitInput ? reviewLimitInput.value : "20";
    let limit = parseInt(limitStr, 10);
    if (!limit || limit <= 0) limit = 20;
    localStorage.setItem('vocab-review-limit', limit);

    reviewQueue = reviewQueue.slice(0, limit);

    if (reviewQueue.length > 0) {
        currentReviewIndex = 0;
        showReviewCard();
    } else {
        showToast('No matching words to review.', 'danger');
    }
});

function showReviewCard() {
    if (currentReviewIndex >= reviewQueue.length) {
        finishReviewSession();
        return;
    }

    setReviewState(reviewCardView);
    flashcardBack.classList.add('hidden');
    showAnswerBtn.style.display = 'inline-flex';
    updateReviewProgress();

    const currentWord = reviewQueue[currentReviewIndex];
    reviewWordDisplay.textContent = currentWord.word;

    // Prepare definitions
    reviewDefinitionsContainer.innerHTML = '';
    if (currentWord.definitions && currentWord.definitions.length > 0) {
        currentWord.definitions.forEach(def => {
            const defItem = document.createElement('div');
            defItem.className = 'word-def-item';
            
            let html = `<div class="word-def-text">`;
            if (def.pos) {
                html += `<span class="pos-badge">${escapeHtml(def.pos)}</span>`;
            }
            html += `${escapeHtml(def.meaning)}</div>`;
            
            if (def.examples && def.examples.length > 0) {
                html += `<ul class="word-examples">`;
                def.examples.forEach(ex => {
                    html += `<li class="word-example-item">${escapeHtml(ex)}</li>`;
                });
                html += `</ul>`;
            }
            
            defItem.innerHTML = html;
            reviewDefinitionsContainer.appendChild(defItem);
        });
    }

    if (currentWord.tags && currentWord.tags.length > 0) {
        const tagList = document.createElement('div');
        tagList.className = 'word-tags';
        currentWord.tags.forEach(tag => {
            const t = document.createElement('span');
            t.className = 'tag-chip';
            t.textContent = tag;
            tagList.appendChild(t);
        });
        reviewDefinitionsContainer.appendChild(tagList);
    }
}

showAnswerBtn.addEventListener('click', () => {
    showAnswerBtn.style.display = 'none';
    flashcardBack.classList.remove('hidden');
});

document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const grade = parseInt(e.currentTarget.getAttribute('data-grade'), 10);
        processGrade(grade);
    });
});

async function processGrade(quality) {
    const currentWord = reviewQueue[currentReviewIndex];
    const radioRandom = document.querySelector('input[name="review-mode"][value="random"]');
    const isRandomMode = radioRandom && radioRandom.checked;
    
    if (!isRandomMode) {
        // Default initial values
        let { 
            repetition = 0, 
            interval = 1, 
            ease_factor = 2.5 
        } = currentWord.review_data || {};

        if (quality >= 3) {
            if (repetition === 0) {
                interval = 1;
            } else if (repetition === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * ease_factor);
            }
            repetition += 1;
        } else {
            repetition = 0;
            interval = 1;
        }

        ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ease_factor < 1.3) ease_factor = 1.3;

        // Convert days to milliseconds for next review
        const next_review_date = Date.now() + interval * 24 * 60 * 60 * 1000;

        currentWord.review_data = {
            repetition,
            interval,
            ease_factor,
            next_review_date
        };

        // Replace the object in cachedVocab
        const indexInCache = cachedVocab.findIndex(w => w.id === currentWord.id);
        if (indexInCache !== -1) {
            cachedVocab[indexInCache] = currentWord;
        }
    }

    currentReviewIndex++;
    showReviewCard();
}

async function finishReviewSession() {
    setReviewState(reviewDoneView);
    reviewQueue = [];   // Clear so returning to Review tab won't re-enter cards
    currentReviewIndex = 0;
    await saveVocabData(cachedVocab);
}

reviewHomeBtn.addEventListener('click', () => {
    initReviewSession();
});

// --- Review progress display ---
function updateReviewProgress() {
    const progressText = document.getElementById('review-progress-text');
    const progressBar = document.getElementById('review-progress-bar');
    const total = reviewQueue.length;
    if (progressText) progressText.textContent = `${currentReviewIndex + 1} / ${total}`;
    if (progressBar) {
        const pct = total > 0 ? (currentReviewIndex / total) * 100 : 0;
        progressBar.style.width = pct + '%';
    }
}

// --- Exit Review Button ---
const exitReviewBtn = document.getElementById('exit-review-btn');
if (exitReviewBtn) {
    exitReviewBtn.addEventListener('click', () => {
        reviewQueue = [];
        currentReviewIndex = 0;
        void saveVocabData(cachedVocab);
        initReviewSession();
    });
}

// --- MD3 Ripple Effect ---
document.addEventListener('mousedown', function (e) {
    const target = e.target.closest('.btn, .nav-btn, .word-card, .tag-pill-btn, .sort-order-btn');
    if (!target) return;

    if (!target.classList.contains('ripple-surface')) {
        target.classList.add('ripple-surface');
    }

    const circle = document.createElement('span');
    const diameter = Math.max(target.clientWidth, target.clientHeight);
    const radius = diameter / 2;

    const rect = target.getBoundingClientRect();
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');

    const existingRipple = target.querySelector('.ripple');
    if (existingRipple) {
        existingRipple.remove();
    }

    target.appendChild(circle);
    
    setTimeout(() => {
        if (circle.parentNode) {
            circle.remove();
        }
    }, 600);
});
