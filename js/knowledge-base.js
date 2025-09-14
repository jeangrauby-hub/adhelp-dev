// Module de gestion de la base de connaissances
(function() {
  let articles = [];

  // Compteur global pour z-index des modals (effet pile)
  window.modalZIndexCounter = window.modalZIndexCounter || 1000;

  // Charger les articles depuis le fichier JSON
  async function loadArticles() {
    try {
      const response = await fetch('data/knowledge-base.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
       const data = await response.json();
      articles = Array.isArray(data) ? data : (data.articles || []);

      // Construire le blob de recherche (titre + contenu + texte PJ simulé)
      articles = articles.map(a => {
        const attText = (a.attachments || [])
          .map(att => att.extractedText || '')
          .join(' ');
        const blob = [a.title || '', a.content || '', attText].join(' ');
        return { ...a, _searchBlob: normalizeText(blob) };
      });

      renderArticles();
    } catch (error) {
      console.error('[KB] Erreur chargement articles:', error);
      const tbody = document.getElementById('kbTbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td class="empty" colspan="4">Erreur de chargement des articles</td></tr>';
      }
    }
  }

  // Échapper le HTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Normalisation (minuscules + suppression accents)
  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Afficher les articles dans le tableau
  function renderArticles() {
    const tbody = document.getElementById('kbTbody');
    if (!tbody) return;

    if (articles.length === 0) {
      tbody.innerHTML = '<tr><td class="empty" colspan="4">Aucun article trouvé</td></tr>';
      return;
    }

    const html = articles.map(article => `
      <tr>
        <td class="col-subject">
          <a href="#" class="article-link" data-article-id="${article.id || ''}">${escapeHtml(article.title || '')}</a>
        </td>
        <td class="col-assignee">${escapeHtml(article.category || '')}</td>
        <td class="col-status">${escapeHtml(article.author || '')}</td>
        <td class="col-attachments">${(article.attachments && article.attachments.length) || 0}</td>
      </tr>
    `).join('');

    tbody.innerHTML = html;

    // Ajouter les événements de clic sur les articles (délégation d'événements)
    tbody.addEventListener('click', handleArticleClick);
  }

  // Filtrer les articles selon la recherche
  function filterArticles(searchTerm) {
    const tbody = document.getElementById('kbTbody');
    if (!tbody) return;

    const searchWords = normalizeText(searchTerm).split(/\s+/).filter(Boolean);
    
    if (searchWords.length === 0) {
      // Pas de recherche, afficher tous les articles
      renderArticles();
      return;
    }

    const filteredArticles = articles.filter(article => {
      const searchableText = article._searchBlob || '';
      return searchWords.every(word => searchableText.includes(word));
    });

    if (filteredArticles.length === 0) {
      tbody.innerHTML = '<tr><td class="empty" colspan="4">Aucun article ne correspond à votre recherche</td></tr>';
      return;
    }

    const html = filteredArticles.map(article => `
      <tr>
        <td class="col-subject">
          <a href="#" class="article-link" data-article-id="${article.id || ''}">${escapeHtml(article.title || '')}</a>
        </td>
        <td class="col-assignee">${escapeHtml(article.category || '')}</td>
        <td class="col-status">${escapeHtml(article.author || '')}</td>
        <td class="col-attachments">${(article.attachments && article.attachments.length) || 0}</td>
      </tr>
    `).join('');

    tbody.innerHTML = html;

    // Réattacher les événements
    tbody.addEventListener('click', handleArticleClick);
  }

  // Gestionnaire de clic sur les articles (délégation)
  function handleArticleClick(e) {
    const link = e.target.closest('.article-link');
    if (!link) return;
    
    e.preventDefault();
    
    const articleId = link.dataset.articleId;
    console.log('[KB] Clic sur article ID:', articleId);
    
    const article = articles.find(a => a.id === articleId);
    console.log('[KB] Article trouvé:', article);
    
    if (article) {
      openArticleModal(article); // Mode édition
    }
  }

  // FONCTION PRINCIPALE - PROPRIÉTAIRE UNIQUE
  function openArticleModal(article = null) {
    console.log('[KB] openArticleModal appelée avec:', article);
    
    const modal = document.getElementById('articleModal');
    if (!modal) {
      console.error('[KB] Modal article introuvable');
      return;
    }

    // Éléments de la modal
    const articleId = document.getElementById('articleId');
    const articleTitle = document.getElementById('articleTitle');
    const articleCategory = document.getElementById('articleCategory');
    const articleContent = document.getElementById('articleContent');

    console.log('[KB] Éléments DOM trouvés:', {
      modal: !!modal,
      articleId: !!articleId,
      articleTitle: !!articleTitle,
      articleCategory: !!articleCategory,
      articleContent: !!articleContent
    });

    // ÉTAPE 1: RESET de la modal
    resetModal(articleId, articleTitle, articleCategory, articleContent);
    
    // ÉTAPE 2: POPULATE selon le contexte
    if (article) {
      // Mode ÉDITION
      console.log('[KB] Mode ÉDITION - Remplissage avec:', article);
      populateModal(article, articleId, articleTitle, articleCategory, articleContent);

      // 🔽 Hydrater les PJ existantes dans la modale Article
      if (window.attachmentsManagerArticle) {
        window.attachmentsManagerArticle.hydrate(article.attachments || [], { clear: true });
      }
    } else {
      // Mode CRÉATION
      console.log('[KB] Mode CRÉATION - Article vide');
      setCreateMode(articleId);

      // 🔽 Vider la liste PJ si nouveau
      if (window.attachmentsManagerArticle) {
        window.attachmentsManagerArticle.hydrate([], { clear: true });
      }
    }
      // ÉTAPE 3: OUVERTURE
    modal.style.display = 'flex';
    
    // Z-index dynamique pour passer devant les autres modals
    window.modalZIndexCounter++;
    modal.style.zIndex = window.modalZIndexCounter;
    
    // Focus sur le titre pour commencer la saisie
    if (articleTitle) {
      setTimeout(() => articleTitle.focus(), 100);
    }
  }

  // Reset complet de la modal
  function resetModal(articleId, articleTitle, articleCategory, articleContent) {
    console.log('[KB] Reset modal');
    if (articleId) articleId.textContent = '';
    if (articleTitle) articleTitle.value = '';
    if (articleCategory) articleCategory.value = '';
if (articleContent) articleContent.innerHTML = '';
}

  // Remplir la modal avec les données d'un article
  function populateModal(article, articleId, articleTitle, articleCategory, articleContent) {
    if (articleId) articleId.textContent = article.id || '';
    if (articleTitle) articleTitle.value = article.title || '';
    if (articleCategory) {
      // Vérifier que la catégorie existe dans les options
      const categoryExists = Array.from(articleCategory.options).some(opt => opt.value === article.category);
      articleCategory.value = categoryExists ? article.category : '';
    }
if (articleContent) articleContent.innerHTML = article.content || '';

    console.log('[KB] Modal remplie - Titre:', articleTitle?.value, 'Catégorie:', articleCategory?.value);
  }

  // Mode création avec ID généré
  function setCreateMode(articleId) {
    if (articleId) {
      articleId.textContent = 'A' + String(Date.now()).slice(-3);
    }
  }

  // Initialiser les gestionnaires de fermeture
  function initModalHandlers() {
    const closeArticleModal = document.getElementById('closeArticleModal');
    const articleModal = document.getElementById('articleModal');
    
    if (closeArticleModal) {
      closeArticleModal.addEventListener('click', () => {
        if (articleModal) articleModal.style.display = 'none';
      });
    }

    if (articleModal) {
      articleModal.addEventListener('click', (e) => {
        if (e.target === articleModal) {
          articleModal.style.display = 'none';
        }
      });
    }

// Gestionnaire de recherche
const articleSearch = document.getElementById('articleSearch');
if (articleSearch) {
  articleSearch.addEventListener('input', (e) => {
    filterArticles(e.target.value);
  });
}

// Un seul listener de délégation sur le tableau Articles
const kbTbody = document.getElementById('kbTbody');
if (kbTbody && !kbTbody._kbClickBound) {
  kbTbody.addEventListener('click', handleArticleClick);
  kbTbody._kbClickBound = true;
}
  }

  // EXPOSITION GLOBALE - SOURCE DE VÉRITÉ UNIQUE
  window.openArticleModal = openArticleModal;

  // API publique du module
  window.knowledgeBase = {
    loadArticles,
    getArticles: () => articles,
    openArticleModal // Aussi disponible via l'espace de nom
  };

  // Initialisation
 document.addEventListener('DOMContentLoaded', function() {
    loadArticles();
    initModalHandlers();

    // ⬇️ Instancie le gestionnaire PJ pour la modale Article (si pas déjà créé)
    const articleModal = document.getElementById('articleModal');
    if (articleModal && !window.attachmentsManagerArticle && typeof AttachmentsManager === 'function') {
      window.attachmentsManagerArticle = new AttachmentsManager({ root: articleModal });
      console.log('[KB] AttachmentsManager Article initialisé');
    }
  
    console.log('[KB] Module Articles initialisé - openArticleModal disponible');
  });
})();