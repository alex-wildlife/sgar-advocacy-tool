class SGARTracker {
  constructor(data) {
    this.councils = data;
    this.currentView = 'grid';
    this.filters = { status: [], region: [], search: '', quickFilter: null };
    this.map = null;
    this.init();
  }

  init() {
    this.updateStats();
    this.animateNumbers();
    this.setupUnifiedSearch();
    this.setupViewToggle();
    this.renderCouncils();
  }

  /* ============================
     Stats + Progress
  ============================ */
  updateStats() {
    const stats = {
      total: this.councils.length,
      using: this.councils.filter(c => c.status === 'Yes').length,
      free: this.councils.filter(c => c.status === 'No').length,
      unknown: this.councils.filter(c => c.status === 'Unknown').length
    };

    document.getElementById('stat-using-sgars').setAttribute('data-count', stats.using);
    document.getElementById('stat-sgar-free').setAttribute('data-count', stats.free);
    document.getElementById('stat-unknown').setAttribute('data-count', stats.unknown);
    document.getElementById('stat-total').setAttribute('data-count', stats.total);

    const percent = stats.total > 0 ? Math.round((stats.free / stats.total) * 100) : 0;
    document.getElementById('progress-percentage').textContent = `${percent}%`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  animateNumbers() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const count = parseInt(el.getAttribute('data-count'));
      let current = 0, step = Math.max(1, count / 50);
      const update = () => {
        current += step;
        if (current < count) {
          el.textContent = Math.floor(current);
          requestAnimationFrame(update);
        } else {
          el.textContent = count;
        }
      };
      update();
    });
  }

  /* ============================
     Unified Search
  ============================ */
  setupUnifiedSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');

    if (!input) return;

    input.addEventListener('input', e => {
      this.filters.search = e.target.value.toLowerCase();
      clearBtn.style.display = this.filters.search ? 'flex' : 'none';
      this.renderCouncils();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      this.filters.search = '';
      clearBtn.style.display = 'none';
      this.renderCouncils();
    });
  }

  /* ============================
     View Toggle
  ============================ */
  setupViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.currentView = view;

        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.getElementById('councilGrid').style.display = view === 'grid' ? 'grid' : 'none';
        document.getElementById('mapView').style.display = view === 'map' ? 'block' : 'none';

        if (view === 'map' && !this.map) {
          this.initMap();
        }
      });
    });
  }

  /* ============================
     Councils Rendering
  ============================ */
  renderCouncils() {
    const grid = document.getElementById('councilGrid');
    if (!grid) return;

    const filtered = this.councils.filter(c => {
      if (this.filters.search && !c.name.toLowerCase().includes(this.filters.search)) return false;
      return true;
    });

    grid.innerHTML = filtered.map(c => `
      <article class="council-card ${c.status === 'Yes' ? 'danger' : c.status === 'No' ? 'success' : 'warning'}">
        <div class="council-status-indicator"></div>
        ${c.wildlifeRisk === 'high' ? '<div class="wildlife-impact high">🦉</div>' : ''}
        <div class="council-card-header">
          <h3 class="council-name">${c.name}</h3>
          <span class="council-status">${c.status}</span>
        </div>
        ${c.notes ? `<p class="council-notes">${c.notes}</p>` : ''}
      </article>
    `).join('');
  }

  /* ============================
     Map Initialisation
  ============================ */
  initMap() {
    try {
      this.map = new ol.Map({
        target: 'map',
        layers: [
          new ol.layer.Tile({
            source: new ol.source.OSM()
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([147, -32]), // NSW approx center
          zoom: 5
        })
      });
    } catch (err) {
      console.error("Map failed to initialise:", err);
      document.getElementById('map').innerHTML = "<p>Map unavailable</p>";
    }
  }
}

/* ============================
   Initialise App with councils.json
============================ */
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/councils.json')
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load councils.json: ${response.status}`);
      return response.json();
    })
    .then(rawData => {
      // Convert keyed object into array of council objects
      const data = Object.entries(rawData).map(([name, details]) => ({
        name,
        status: details.sgars,
        notes: details.notes,
        email: details.email
      }));
      console.log(`Loaded ${data.length} councils from JSON`);
      window.app = new SGARTracker(data);
    })
    .catch(err => {
      console.error('Error loading councils.json:', err);
      window.app = new SGARTracker([]); // fallback empty dataset
    });
});
