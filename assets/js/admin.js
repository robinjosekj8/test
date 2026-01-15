let config = [];
let settings = {
    activeHours: { enabled: false, start: "08:00", end: "22:00" },
    brightness: { enabled: false, start: "20:00", end: "06:00", level: 50 }
};
let currentEditingId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAuth();
    loadContent();
    loadSettings();
});

function loadAuth() {
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');
    if (repo) document.getElementById('github-repo').value = repo;
    if (token) document.getElementById('github-token').value = token;

    if (repo && token) {
        document.getElementById('content-section').style.display = 'block';
        document.getElementById('settings-section').style.display = 'block';
    } else {
        document.getElementById('settings-section').style.display = 'none';
    }
}

function saveAuth() {
    const repo = document.getElementById('github-repo').value.trim();
    const token = document.getElementById('github-token').value.trim();

    if (!repo || !token) {
        showStatus('auth-status', 'Please provide both repo and token', 'error');
        return;
    }

    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_token', token);
    showStatus('auth-status', 'Configuration saved locally!', 'success');
    document.getElementById('content-section').style.display = 'block';
    document.getElementById('settings-section').style.display = 'block';
    loadContent();
    loadSettings();
}

function showStatus(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `status-msg ${type}`;
    setTimeout(() => { el.className = 'status-msg'; }, 5000);
}

async function loadContent() {
    try {
        const response = await fetch('content/config.json');
        config = await response.json();
        renderContentList();
    } catch (e) {
        console.error("Failed to load config.json", e);
        document.getElementById('content-list').innerHTML = '<p class="error">Failed to load content/config.json. Make sure it exists.</p>';
    }
}

async function loadSettings() {
    try {
        const response = await fetch('content/settings.json');
        if (response.ok) {
            settings = await response.json();

            // Populate UI
            if (settings.activeHours) {
                document.getElementById('active-enabled').checked = settings.activeHours.enabled;
                document.getElementById('active-start').value = settings.activeHours.start;
                document.getElementById('active-end').value = settings.activeHours.end;
            }
            if (settings.brightness) {
                document.getElementById('bright-enabled').checked = settings.brightness.enabled;
                document.getElementById('bright-start').value = settings.brightness.start;
                document.getElementById('bright-end').value = settings.brightness.end;
                document.getElementById('bright-level').value = settings.brightness.level;
                document.getElementById('level-val').innerText = settings.brightness.level + '%';
            }
        }
    } catch (e) {
        console.log("No settings.json found, using defaults");
    }
}

async function saveSettings() {
    settings.activeHours = {
        enabled: document.getElementById('active-enabled').checked,
        start: document.getElementById('active-start').value || "08:00",
        end: document.getElementById('active-end').value || "22:00"
    };

    settings.brightness = {
        enabled: document.getElementById('bright-enabled').checked,
        start: document.getElementById('bright-start').value || "20:00",
        end: document.getElementById('bright-end').value || "08:00",
        level: document.getElementById('bright-level').value
    };

    const statusEl = 'settings-status';
    showStatus(statusEl, 'Saving settings to GitHub...', 'success');

    try {
        await updateFileInGithub('content/settings.json', JSON.stringify(settings, null, 2));
        showStatus(statusEl, 'Settings saved successfully!', 'success');
    } catch (e) {
        console.error(e);
        showStatus(statusEl, `Error: ${e.message}`, 'error');
    }
}

function renderContentList() {
    const container = document.getElementById('content-list');
    container.innerHTML = '';

    config.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <div class="card-preview">
                ${item.type === 'video'
                ? `<video src="${item.preview}" muted></video>`
                : `<img src="${item.preview}" onerror="this.src='${item.path}/1.jpg'">`}
            </div>
            <div class="card-info">
                <h3>${item.title}</h3>
                <p>${item.path} (${item.type})</p>
                <div id="url-preview-${item.id}" style="font-size: 0.8rem; color: #aaa; margin-top: 5px;">Loading URL...</div>
            </div>
            <div class="card-actions">
                <button class="btn" onclick="openEditModal('${item.id}')">Edit / Upload</button>
            </div>
        `;
        container.appendChild(card);
        fetchUrlTxt(item);
    });
}

async function fetchUrlTxt(item) {
    try {
        const r = await fetch(`${item.path}/url.txt`);
        if (r.ok) {
            const text = await r.text();
            document.getElementById(`url-preview-${item.id}`).textContent = `URL: ${text.trim() || 'None'}`;
        } else {
            document.getElementById(`url-preview-${item.id}`).textContent = `URL: (No url.txt)`;
        }
    } catch (e) {
        document.getElementById(`url-preview-${item.id}`).textContent = `URL: error loading`;
    }
}

function openAddModal() {
    currentEditingId = null;
    document.getElementById('modal-title').textContent = "Add New Stream";
    document.getElementById('edit-title').value = "";
    document.getElementById('edit-url').value = "";
    document.getElementById('upload-group').style.display = "block";
    document.getElementById('edit-modal').style.display = 'flex';
}

function openEditModal(id) {
    currentEditingId = id;
    const item = config.find(i => i.id === id);
    document.getElementById('modal-title').textContent = `Edit ${item.title}`;
    document.getElementById('edit-title').value = item.title;

    // Fetch current url.txt content for the modal
    fetch(`${item.path}/url.txt`)
        .then(r => r.ok ? r.text() : '')
        .then(text => {
            document.getElementById('edit-url').value = text.trim();
        });

    document.getElementById('edit-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('edit-file').value = '';
    document.getElementById('upload-group').style.display = "block";
}

async function githubRequest(path, method = 'GET', body = null) {
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;

    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    return response;
}

// Helper for robust base64
function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

async function saveStreamChanges() {
    const newTitle = document.getElementById('edit-title').value.trim();
    const newUrl = document.getElementById('edit-url').value.trim();
    const fileInput = document.getElementById('edit-file');
    const statusEl = 'modal-status';

    if (!newTitle) {
        showStatus(statusEl, 'Title is required', 'error');
        return;
    }

    showStatus(statusEl, 'Starting push to GitHub...', 'success');

    try {
        let item;
        if (currentEditingId) {
            item = config.find(i => i.id === currentEditingId);
        } else {
            // New item logic
            const id = 'stream_' + Date.now();
            item = {
                id: id,
                title: newTitle,
                path: `content/${id}`,
                type: fileInput.files.length > 0 && fileInput.files[0].type.includes('video') ? 'video' : 'image',
                preview: ""
            };
            config.push(item);
        }

        // 1. Update url.txt (Always update, enabling "clear" by sending empty string)
        await updateFileInGithub(`${item.path}/url.txt`, newUrl);

        // 2. Upload file if selected
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const extension = file.name.split('.').pop();
            const fileName = `1.${extension}`;

            // CLEANUP: Delete conflicting files (e.g. delete 1.png if uploading 1.jpg)
            try {
                showStatus(statusEl, 'Cleaning up old files...', 'success');
                const dirRes = await githubRequest(item.path);
                if (dirRes.ok) {
                    const files = await dirRes.json();
                    if (Array.isArray(files)) {
                        for (const f of files) {
                            // Delete any '1.*' file that isn't the one we are about to upload/overwrite
                            // This prevents having both 1.png and 1.jpg
                            if (f.name.startsWith('1.') && f.name !== fileName) {
                                await deleteFileInGithub(f.path, f.sha);
                            }
                        }
                    }
                }
            } catch (cleanupErr) {
                console.warn("Cleanup warning:", cleanupErr);
            }

            const base64 = await toBase64(file);
            await uploadBinaryToGithub(`${item.path}/${fileName}`, base64);

            item.preview = `${item.path}/${fileName}`;
            item.type = file.type.includes('video') ? 'video' : 'image';
        }

        // 3. Update Title
        item.title = newTitle;

        // Save updated config.json
        await updateFileInGithub('content/config.json', JSON.stringify(config, null, 2));

        showStatus(statusEl, 'Successfully updated and pushed to GitHub!', 'success');
        setTimeout(() => {
            closeModal();
            loadContent();
        }, 1500);

    } catch (e) {
        console.error(e);
        showStatus(statusEl, `Error: ${e.message}`, 'error');
    }
}

async function updateFileInGithub(path, content) {
    // Get SHA of existing file if it exists
    let sha = null;
    const getRes = await githubRequest(path);
    if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
    }

    const body = {
        message: `Update ${path} via Admin Dashboard`,
        content: utf8_to_b64(content),
        sha: sha
    };

    const putRes = await githubRequest(path, 'PUT', body);
    if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `Failed to update ${path}`);
    }
}

async function deleteFileInGithub(path, sha) {
    const body = {
        message: `Delete ${path} via Admin Dashboard`,
        sha: sha
    };
    const res = await githubRequest(path, 'DELETE', body);
    if (!res.ok) {
        throw new Error(`Failed to delete ${path}`);
    }
}

async function uploadBinaryToGithub(path, base64Content) {
    // base64Content is expected to be just the data part (no data:image/png;base64,)
    let sha = null;
    const getRes = await githubRequest(path);
    if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
    }

    const body = {
        message: `Upload ${path} via Admin Dashboard`,
        content: base64Content,
        sha: sha
    };

    const putRes = await githubRequest(path, 'PUT', body);
    if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `Failed to upload ${path}`);
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}
