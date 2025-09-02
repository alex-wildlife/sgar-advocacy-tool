class SGARTracker {
  constructor(data) {
    this.councils = data;
    this.init();
  }

  init() {
    this.updateStats();
    this.animateNumbers();
    this.renderCouncils();
  }

  updateStats() {
    const stats = {
      total: this.councils.length,
      using: this.councils.filter(c => c.status === 'Yes').length,
      free: this.councils.filter(c => c.status === 'No').length,
      unknown: this.councils.filter(c => c.status === 'Unknown').length,
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
    const els = document.querySelectorAll('[data-count]');
    els.forEach(el => {
      const count = parseInt(el.getAttribute('data-count'));
      let current = 0;
      const step = count / 50;
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

  renderCouncils() {
    const grid = document.getElementById('councilGrid');
    grid.innerHTML = this.councils.map(c => `
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
  // Example data
  const data = [
    { name: 'Sydney Council', status: 'Yes', wildlifeRisk: 'high' },
    { name: 'Byron Council', status: 'No', wildlifeRisk: 'low' },
    { name: 'Dubbo Council', status: 'Unknown', wildlifeRisk: 'low' }
  ];
  window.app = new SGARTracker(data);
});
