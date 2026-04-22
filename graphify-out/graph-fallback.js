// Offline fallback for environments where the CDN vis-network bundle is blocked.
// It implements only the subset of vis used by the generated Graphify report.
if (!window.vis) {
  window.vis = {};

  vis.DataSet = class {
    constructor(items) {
      this.items = new Map();
      (items || []).forEach(item => this.items.set(item.id, Object.assign({}, item)));
    }

    map(fn) {
      return Array.from(this.items.values()).map(fn);
    }

    get(id) {
      return this.items.get(id);
    }

    update(updates) {
      (updates || []).forEach(update => {
        const current = this.items.get(update.id) || {};
        this.items.set(update.id, Object.assign({}, current, update));
      });
      if (this._onUpdate) this._onUpdate();
    }
  };

  vis.Network = class {
    constructor(container, data) {
      this.container = container;
      this.nodes = data.nodes;
      this.edges = data.edges;
      this.handlers = {};
      this.onceHandlers = {};
      this.selected = new Set();
      this.positions = {};
      this.hovered = null;
      this.canvas = document.createElement("canvas");
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.display = "block";
      container.appendChild(this.canvas);
      this.nodes._onUpdate = () => this.layout();
      window.addEventListener("resize", () => this.layout());
      this.canvas.addEventListener("click", event => this.handlePointer(event, "click"));
      this.canvas.addEventListener("mousemove", event => this.handleHover(event));
      this.layout();
      setTimeout(() => {
        this.emitOnce("stabilizationIterationsDone", {});
        this.draw();
      }, 0);
    }

    once(name, cb) {
      this.onceHandlers[name] = cb;
    }

    on(name, cb) {
      if (!this.handlers[name]) this.handlers[name] = [];
      this.handlers[name].push(cb);
    }

    setOptions() {}

    selectNodes(ids) {
      this.selected = new Set(ids || []);
      this.draw();
    }

    focus(id) {
      this.selectNodes([id]);
    }

    getPositions(ids) {
      const result = {};
      (ids || Object.keys(this.positions)).forEach(id => {
        if (this.positions[id]) result[id] = this.positions[id];
      });
      return result;
    }

    getConnectedNodes(nodeId) {
      return this.edges.map(e => e)
        .filter(e => e.from === nodeId || e.to === nodeId)
        .map(e => e.from === nodeId ? e.to : e.from);
    }

    emit(name, payload) {
      (this.handlers[name] || []).forEach(cb => cb(payload));
    }

    emitOnce(name, payload) {
      const cb = this.onceHandlers[name];
      if (cb) {
        delete this.onceHandlers[name];
        cb(payload);
      }
    }

    layout() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = Math.max(320, rect.width || 800);
      this.height = Math.max(320, rect.height || 600);
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.ctx = this.canvas.getContext("2d");
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const visibleNodes = this.nodes.map(n => n).filter(n => !n.hidden);
      const byCommunity = new Map();
      visibleNodes.forEach(n => {
        const key = n._community || 0;
        if (!byCommunity.has(key)) byCommunity.set(key, []);
        byCommunity.get(key).push(n);
      });

      const communities = Array.from(byCommunity.keys()).sort((a, b) => a - b);
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const outer = Math.max(120, Math.min(this.width, this.height) * 0.34);
      communities.forEach((community, communityIndex) => {
        const group = byCommunity.get(community);
        const angle = (Math.PI * 2 * communityIndex) / Math.max(1, communities.length);
        const groupX = centerX + Math.cos(angle) * outer;
        const groupY = centerY + Math.sin(angle) * outer;
        const radius = Math.max(34, Math.sqrt(group.length) * 18);
        group.forEach((node, i) => {
          const a = (Math.PI * 2 * i) / Math.max(1, group.length);
          const spiral = radius * (0.35 + (i % 7) / 10);
          this.positions[node.id] = {
            x: groupX + Math.cos(a) * spiral,
            y: groupY + Math.sin(a) * spiral,
          };
        });
      });
      this.draw();
    }

    draw() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(0, 0, this.width, this.height);

      const hidden = new Set(this.nodes.map(n => n).filter(n => n.hidden).map(n => n.id));
      ctx.globalAlpha = 0.32;
      this.edges.map(e => e).forEach(edge => {
        if (hidden.has(edge.from) || hidden.has(edge.to)) return;
        const a = this.positions[edge.from];
        const b = this.positions[edge.to];
        if (!a || !b) return;
        ctx.strokeStyle = "#8a8aa8";
        ctx.lineWidth = Math.max(0.5, edge.width || 1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      this.nodes.map(n => n).forEach(node => {
        if (node.hidden) return;
        const p = this.positions[node.id];
        if (!p) return;
        const selected = this.selected.has(node.id);
        const r = Math.max(4, Math.min(22, node.size || 8));
        ctx.fillStyle = node.color && node.color.background ? node.color.background : "#4E79A7";
        ctx.strokeStyle = selected ? "#ffffff" : (node.color && node.color.border ? node.color.border : ctx.fillStyle);
        ctx.lineWidth = selected ? 4 : 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, selected ? r + 3 : r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if ((node.font && node.font.size > 0) || selected) {
          ctx.fillStyle = "#ffffff";
          ctx.font = selected ? "12px sans-serif" : `${node.font.size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(node.label, p.x, p.y - r - 8);
        }
      });
      this.emit("afterDrawing", ctx);
    }

    nearestNode(event) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best = null;
      let bestDistance = Infinity;
      this.nodes.map(n => n).forEach(node => {
        if (node.hidden) return;
        const p = this.positions[node.id];
        if (!p) return;
        const distance = Math.hypot(p.x - x, p.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      });
      return best && bestDistance < Math.max(24, best.size + 10) ? best : null;
    }

    handlePointer(event, name) {
      const node = this.nearestNode(event);
      const payload = { nodes: node ? [node.id] : [] };
      if (node) this.selectNodes([node.id]);
      this.emit(name, payload);
    }

    handleHover(event) {
      const node = this.nearestNode(event);
      if (node && this.hovered !== node.id) {
        this.hovered = node.id;
        this.emit("hoverNode", { node: node.id });
      } else if (!node && this.hovered) {
        this.hovered = null;
        this.emit("blurNode", {});
      }
    }
  };
}
