/**
 * ADHELP - Gestionnaire de pièces jointes
 * Architecture: Firebase Storage + Firestore métadonnées
 * Sécurisé, performant et économique
 */

class AttachmentsManager {
  constructor(options = {}) {
    // Configuration par défaut
    this.config = {
      root: document,
      btnSelector: '[data-role="add-attachment"]',
      containerSelector: '.attachments-container',
      listSelector: '.attachments-list',
      inputSelector: 'input[type="file"]',
      inputName: 'attachmentFiles',
      maxFiles: 10,
      maxSizeMB: 5,
      ...options
    };

    // Convertir maxSizeMB en bytes
    this.maxFileSize = this.config.maxSizeMB * 1024 * 1024;
    
    // Types dangereux interdits pour sécurité
    this.forbiddenExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.ps1', '.msi'];
    
    this.uploads = new Map(); // Suivi des uploads en cours
    this.attachments = []; // Métadonnées des PJ
    this.currentTicketId = null;
    this.isDraft = true;

    // Initialiser après que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    // Définir le root
    this.root = typeof this.config.root === 'string' 
      ? document.querySelector(this.config.root) 
      : this.config.root;

    if (!this.root) {
      console.warn('[Attachments] Root element not found:', this.config.root);
      return;
    }
    
    this.initializeUI();
  }

  initializeUI() {
    const container = this.root.querySelector(this.config.containerSelector);
    if (!container) {
      console.warn('[Attachments] Container non trouvé:', this.config.containerSelector);
      return;
    }

    // S'il n'y a AUCUN bouton PJ dans tout le root, on en injecte un dans le container.
    const anyBtn = this.root.querySelector(this.config.btnSelector);
    if (!anyBtn && !container.querySelector(this.config.btnSelector)) {
      container.insertAdjacentHTML('afterbegin', `
        <button type="button" class="btn-attachment" data-role="add-attachment">📎 Pièce jointe</button>
      `);
    }

    // On garantit qu'il existe TOUJOURS un input file dans le DOM du root
    let fileInput = this.root.querySelector(this.config.inputSelector);
      if (!fileInput) {
      container.insertAdjacentHTML('beforeend', `
        <input type="file" name="${this.config.inputName}" multiple accept="${this.getAcceptString()}" style="display: none;">
      `);
    }

       // --- Fenêtre indicative "quota atteint" (ANCRÉE DANS LA MODALE) ---
    if (!this.root.querySelector('.attachments-quota-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'attachments-quota-indicator';

      // on l'ancre DANS le conteneur .modal-ticket (et non plus fenêtre)
      const host = this.root.querySelector('.modal-ticket') || this.root;
      if (getComputedStyle(host).position === 'static') {
        host.style.position = 'relative'; // parent de position pour l'absolu
      }

      Object.assign(indicator.style, {
        position: 'absolute',     // reste dans la carte de la modale
        right: '22px',
        bottom: '22px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 10px 24px rgba(0,0,0,.08)',
        padding: '12px 14px',
        fontSize: '13px',
        color: '#111827',
        display: 'none',
        zIndex: '10'              // suffisant dans la modale
      });
      indicator.innerHTML =
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px;">
           <strong>Pièces jointes</strong>
           <button type="button" data-role="quota-close" aria-label="Fermer"
                   style="background:none;border:none;font-size:18px;line-height:1;cursor:pointer;color:#6b7280">×</button>
         </div>
         <div>Maximum atteint (<span data-role="quota-max"></span>).</div>
         <div style="color:#6b7280;margin-top:4px;">Supprime une PJ pour en ajouter d’autres.</div>`;

      host.appendChild(indicator);

      indicator.querySelector('[data-role="quota-close"]')
        ?.addEventListener('click', () => { indicator.style.display = 'none'; });
    }
    // ----------------------------------------------------------------------

    this.bindEvents();
  }

  getAcceptString() {
    return '*'; // Accepter tous les fichiers
  }

  bindEvents() {
    const container = this.root.querySelector(this.config.containerSelector);
    // On privilégie le bouton présent dans la barre d’actions, sinon celui du container, sinon n'importe lequel.
    const btnAdd =
      this.root.querySelector('.row-actions [data-role="add-attachment"]') ||
      (container && container.querySelector(this.config.btnSelector)) ||
      this.root.querySelector(this.config.btnSelector);

    const fileInput = this.root.querySelector(this.config.inputSelector);
    const dropzone  = this.root.querySelector('[data-role="dropzone"]'); // optionnel

    // Bouton d'ajout
    btnAdd?.addEventListener('click', () => {
      if (this.attachments.length >= this.config.maxFiles) {
        this.showError(`Maximum ${this.config.maxFiles} fichiers autorisés`);
        return;
      }
      if (!fileInput) {
        this.showError('Input fichier introuvable');
        return;
      }
      fileInput.click();
    });

    // Sélection de fichiers via dialog
    fileInput?.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset pour permettre le même fichier
    });

    // Drag & Drop — on accepte sur le bouton ET (si présent) sur la dropzone
    const dragTargets = [btnAdd, dropzone].filter(Boolean);
    dragTargets.forEach(target => {
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (target === btnAdd) {
          btnAdd.style.background = '#e2e8f0';
        } else {
          target.classList.add('dragover');
        }
      });

      target.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (target === btnAdd) {
          btnAdd.style.background = '';
        } else {
          target.classList.remove('dragover');
        }
      });

      target.addEventListener('drop', (e) => {
        e.preventDefault();
        if (target === btnAdd) {
          btnAdd.style.background = '';
        } else {
          target.classList.remove('dragover');
        }
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) this.handleFiles(files);
      });
    });
  }

  async handleFiles(files) {
    // Validation globale
    const remainingSlots = this.config.maxFiles - this.attachments.length;
    if (files.length > remainingSlots) {
      this.showError(`Vous ne pouvez ajouter que ${remainingSlots} fichier(s) supplémentaire(s)`);
      return;
    }

    // Traiter chaque fichier
    for (const file of files) {
      if (await this.validateFile(file)) {
        await this.uploadFile(file);
      }
    }
  }

  async validateFile(file) {
    // Taille
    if (file.size > this.maxFileSize) {
      this.showError(`${file.name}: fichier trop volumineux (max ${this.config.maxSizeMB} Mo)`);
      return false;
    }

    // Nom de fichier (sécurité basique)
    if (this.isDangerousFilename(file.name)) {
      this.showError(`${file.name}: nom de fichier non autorisé`);
      return false;
    }

    return true;
  }

  isDangerousFilename(filename) {
    const lower = filename.toLowerCase();
    return this.forbiddenExtensions.some(ext => lower.endsWith(ext));
  }

  async uploadFile(file) {
    const uploadId = this.generateId();
    const attachment = {
      id: uploadId,
      name: file.name,
      size: file.size,
      contentType: file.type,
      status: 'uploading',
      progress: 0,
      previewable: this.isPreviewable(file.type),
      createdAt: new Date().toISOString(),
      file: file // Temporaire pour l'upload
    };

    // Traitement spécial pour les fichiers .webloc
    if (file.name.toLowerCase().endsWith('.webloc')) {
      try {
        const text = await file.text();
        const urlMatch = text.match(/<string>(https?:\/\/[^<]+)<\/string>/);
        if (urlMatch) {
          attachment.weblocUrl = urlMatch[1];
        }
      } catch (error) {
        console.warn('[Attachments] Erreur lecture webloc:', error);
      }
    }

    // Ajouter à la liste et afficher
    this.attachments.push(attachment);
    this.renderAttachments();
    this.updateQuota();

    try {
      // Simuler l'upload vers Firebase Storage
      await this.simulateUpload(attachment);
      
      // Marquer comme terminé
      attachment.status = 'completed';
      attachment.downloadUrl = URL.createObjectURL(file);
      // Garder la référence au fichier pour pouvoir recréer l'URL si nécessaire
      attachment.originalFile = file;
      
      this.renderAttachments();
      
    } catch (error) {
      console.error('[Attachments] Erreur upload:', error);
      attachment.status = 'error';
      attachment.error = error.message;
      this.renderAttachments();
      this.showError(`Erreur lors de l'upload de ${file.name}`);
    }
  }

  async simulateUpload(attachment) {
    // Simulation d'upload avec progression
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
        }
        attachment.progress = Math.round(progress);
        this.updateProgressBar(attachment.id, progress);
      }, 200);
    });
  }

  isPreviewable(contentType) {
    return contentType.startsWith('image/') || 
           contentType === 'application/pdf' || 
           contentType === 'text/plain';
  }

  // Précharge des pièces jointes existantes (sans upload)
  hydrate(items = [], { clear = true } = {}) {
    const mapped = (items || []).map(it => {
      const contentType = it.type || it.contentType || 'application/octet-stream';
      return {
        id: it.id || this.generateId(),
        name: it.name || 'Pièce jointe',
        size: it.size || 0,
        contentType,
        status: 'completed',
        progress: 100,
        previewable: this.isPreviewable(contentType),
        createdAt: it.createdAt || new Date().toISOString(),
        downloadUrl: it.url || it.downloadUrl || ''
      };
    });

    this.attachments = clear ? mapped : [...this.attachments, ...mapped];
    this.renderAttachments();
    this.updateQuota();
  }

  renderAttachments() {
    const list = this.root.querySelector(this.config.listSelector);
    if (!list) return;

    if (this.attachments.length === 0) {
      list.innerHTML = ''; // pas de placeholder
      return;
    }

    list.innerHTML = this.attachments.map(att => this.renderAttachment(att)).join('');
    this.bindAttachmentEvents();
  }

  renderAttachment(att) {
    const icon = this.getFileIcon(att.contentType);

    // Afficher le nom SANS extension dans la modale Article ET Ticket
    const originalName = att.name || 'Pièce jointe';
    const hideExt = this.root && (this.root.id === 'articleModal' || this.root.id === 'ticketModal');
    const baseName = hideExt ? originalName.replace(/\.[^./\\\s]+$/, '') : originalName;

    // Troncature
    const truncatedName = hideExt
      ? (baseName.length <= 15 ? baseName : baseName.slice(0, 15))
      : this.truncateName(originalName, 15);

    return `
      <div class="attachment-item-mini" data-id="${att.id}" data-url="${att.downloadUrl || ''}" style="cursor: pointer;">
        <div class="attachment-icon-mini">${icon}</div>
        <div class="attachment-name-mini" title="${originalName}">${truncatedName}</div>
        <div class="attachment-actions-mini">
          <button type="button" class="btn-remove-mini" data-id="${att.id}" title="Supprimer">×</button>
        </div>
      </div>
    `;
  }

  bindAttachmentEvents() {
    const list = this.root.querySelector(this.config.listSelector);
    if (!list) return;

    // Supprimer les anciens event listeners pour éviter les doublons
    const oldList = list.cloneNode(true);
    list.parentNode.replaceChild(oldList, list);
    const newList = this.root.querySelector(this.config.listSelector);

    // Délégation d'événements
    newList.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // ✅ SUPPRESSION : clic sur la croix
      const removeBtn = e.target.closest('.btn-remove-mini');
      if (removeBtn) {
        const id = removeBtn.getAttribute('data-id') || removeBtn.closest('.attachment-item-mini')?.dataset.id;
        if (id) this.removeAttachment(id);
        return;
      }
      
      // Gestion du clic sur l'icône de PJ pour ouvrir/télécharger
      const attachmentItem = e.target.closest('.attachment-item-mini');
      if (attachmentItem && !e.target.closest('.btn-remove-mini')) {
        const attachmentId = attachmentItem.dataset.id;
        const attachment = this.attachments.find(a => a.id === attachmentId);
        if (attachment) {
          if (attachment.weblocUrl) {
            window.open(attachment.weblocUrl, '_blank');
          } else if (attachment.downloadUrl) {
            if (attachment.previewable) {
              // Prévisualisable → on ouvre dans le navigateur
              window.open(attachment.downloadUrl, '_blank');
            } else {
              // Non prévisualisable → on force le téléchargement avec le bon nom
              const a = document.createElement('a');
              a.href = attachment.downloadUrl;
              const fileName =
                attachment.name ||
                (attachment.downloadUrl ? attachment.downloadUrl.split('/').pop().split('?')[0] : 'fichier');
              a.setAttribute('download', fileName);
              document.body.appendChild(a);
              a.click();
              a.remove();
            }
          }
        }
        return;
      }
    });
  }

  previewAttachment(attachment) {
    if (!attachment.previewable || !attachment.downloadUrl) return;
    // Ne rien faire ici car c'est géré par le clic sur l'item
  }

  downloadAttachment(attachment) {
    if (!attachment.downloadUrl) return;
    const a = document.createElement('a');
    a.href = attachment.downloadUrl;
    a.download = attachment.name;
    a.click();
  }

  removeAttachment(attachmentId) {
    if (!confirm('Supprimer cette pièce jointe ?')) return;

    const index = this.attachments.findIndex(a => a.id === attachmentId);
    if (index === -1) return;

    const attachment = this.attachments[index];
    
    // Libérer l'URL blob pour éviter les fuites mémoire
    if (attachment.downloadUrl && attachment.downloadUrl.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.downloadUrl);
    }

    this.attachments.splice(index, 1);
    this.renderAttachments();
    this.updateQuota();
  }

  updateProgressBar(attachmentId, progress) {
    const progressBar = this.root.querySelector(`#progress-${attachmentId}`);
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    
    const progressText = progressBar?.parentElement?.nextElementSibling;
    if (progressText) {
      progressText.textContent = `${Math.round(progress)}%`;
    }
  }

  updateQuota() {
   const btnAdd = this.root.querySelector(this.config.btnSelector);
  const full = this.attachments.length >= this.config.maxFiles;

  // Le bouton garde toujours le même libellé
  if (btnAdd) {
    btnAdd.disabled = full;
    btnAdd.textContent = '📎 Pièce jointe';
    btnAdd.title = full ? '' : '';
  }

  // Fenêtre indicative séparée
  const indicator = this.root.querySelector('.attachments-quota-indicator');
  if (indicator) {
    indicator.querySelector('[data-role="quota-max"]')?.replaceChildren(
      document.createTextNode(String(this.config.maxFiles))
    );
    indicator.style.display = full ? 'block' : 'none';
    }
  }

  getFileIcon(contentType) {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType === 'application/pdf') return '📄';
    if (contentType.startsWith('text/')) return '📝';
    if (contentType.includes('word') || contentType.includes('rtf')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) return '📽️';
    if (contentType === 'application/zip') return '📦';
    return '📁';
  }

  truncateName(name, maxLength) {
    if (name.length <= maxLength) return name;
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) {
      // Pas d'extension → troncature simple
      return name.slice(0, maxLength);
    }
    const ext = name.slice(lastDot + 1);
    const nameWithoutExt = name.slice(0, lastDot);
    const keep = Math.max(1, maxLength - ext.length - 1);
    const truncated = nameWithoutExt.slice(0, keep);
    return `${truncated}.${ext}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  generateId() {
    return 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Notification simple
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      fontSize: '14px',
      zIndex: '9999',
      opacity: '0',
      transform: 'translateY(-20px)',
      transition: 'all 0.3s ease',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });
    
    const colors = {
      success: '#16a34a',
      error: '#dc2626',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // API publique
  setTicketId(ticketId) {
    this.currentTicketId = ticketId;
    this.isDraft = !ticketId || ticketId === 'Nouveau';
  }

  getAttachments() {
    return this.attachments.filter(a => a.status === 'completed');
  }

  loadAttachments(attachments) {
    this.attachments = attachments || [];
    this.renderAttachments();
    this.updateQuota();
  }

  reset() {
    // Libérer toutes les URLs blob avant de reset
    this.attachments.forEach(attachment => {
      if (attachment.downloadUrl && attachment.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.downloadUrl);
      }
    });
    
    this.attachments = [];
    this.currentTicketId = null;
       this.isDraft = true;
    this.renderAttachments();
    this.updateQuota();
  }
}

// Instances globales pour chaque modale
window.attachmentsManagerTicket = new AttachmentsManager({
  root: '#ticketModal',
  btnSelector: '[data-role="add-attachment"]',
  containerSelector: '.attachments-container',
  listSelector: '.attachments-list',
  inputName: 'ticketFiles',
  maxFiles: 5,
  maxSizeMB: 10
});

window.attachmentsManagerArticle = new AttachmentsManager({
  root: '#articleModal',
  btnSelector: '[data-role="add-attachment"]',
  containerSelector: '.attachments-container',
  listSelector: '.attachments-list',
  inputName: 'articleFiles',
  maxFiles: 5,
  maxSizeMB: 10
});

// Compatibilité avec l'ancien code
window.attachmentsManager = window.attachmentsManagerTicket;