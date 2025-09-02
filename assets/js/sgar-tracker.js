class SGARTracker {
  constructor(data) {
    this.councils = data;
    this.currentView = 'grid';
    this.filters = { status: [], region: [], search: '', quickFilter: null };
    this.init();
  }

  init() {
    this.updateStats();
    this.animateNumbers();
    this.setupUnifiedSearch();
    this.setupViewToggle();
    this.renderCouncils();
  }

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

    const percent = Math.round((stats.free / stats.total) * 100);
    document.getElementById('progress-percentage').textContent = `${percent}%`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  animateNumbers() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const count = parseInt(el.getAttribute('data-count'));
      let current = 0, step = count / 50;
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

  setupUnifiedSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    const clearBtn = document.getElementById('searchClear');

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

    document.addEventListener('click', e => {
      if (!e.target.closest('.unified-search')) dropdown.classList.remove('active');
    });
  }

  setupViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('councilGrid').style.display = view === 'grid' ? 'grid' : 'none';
        document.getElementById('mapView').style.display = view === 'map' ? 'block' : 'none';
      });
    });
  }

  renderCouncils() {
    const grid = document.getElementById('councilGrid');
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
      </article>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // TODO: replace with real data from councils.json
  const data = [
    { name: 'Sydney Council', status: 'Yes', wildlifeRisk: 'high' },
    { name: 'Byron Council', status: 'No', wildlifeRisk: 'low' },
    { name: 'Dubbo Council', status: 'Unknown', wildlifeRisk: 'low' }
  ];
  window.app = new SGARTracker(data);
});
