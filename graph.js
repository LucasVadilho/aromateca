let rawData;
let simulation;

let width;
let height;
let currentEdgeField;
let currentSizeField;
let selectedNodeId = null;
let graphNodeSelection = null;
let zoomBehavior = null;
let zoomGroup = null;
let simulationNodes = null;
const graphEl = document.getElementById("graph");

function getGraphSize() {
    return {
        width: graphEl.clientWidth || 400,
        height: graphEl.clientHeight || 300,
    };
}

const svg = d3
    .select("#graph")
    .append("svg");

const galleryList = document.getElementById("gallery_list");

let tooltipPinnedNodeId = null;
let tooltipHoverNodeId = null;
let currentRadiusScale = null;
let tooltipLayer = null;
let tooltipContentEl = null;

const TOOLTIP_FO_WIDTH = 280;
const TOOLTIP_FO_HEIGHT = 72;

function fillTooltipContent(d) {
    if (!tooltipContentEl) return;

    tooltipContentEl.replaceChildren();

    const inner = document.createElement("div");
    inner.className = "tooltip__inner";

    const img = document.createElement("img");
    img.className = "tooltip__img";
    img.src = d.images?.[0] ?? "";
    img.alt = d.id ?? "";
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "tooltip__body";

    const idEl = document.createElement("div");
    idEl.className = "tooltip__id";
    idEl.textContent = d.id ?? "";

    const scientific = document.createElement("div");
    scientific.className = "tooltip__scientific";
    scientific.textContent = d.scientific_name ?? "";

    body.append(idEl, scientific);
    inner.append(img, body);
    tooltipContentEl.appendChild(inner);
}

function getActiveTooltipNodeId() {
    return tooltipHoverNodeId ?? tooltipPinnedNodeId;
}

function isTooltipVisible() {
    return tooltipLayer && !tooltipLayer.classed("tooltip-layer--hidden");
}

function positionTooltip(d) {
    if (!tooltipLayer || !d || d.x == null || d.y == null || !currentRadiusScale) return;

    const r = currentRadiusScale(d[currentSizeField] || 1) || 8;
    const gap = 12;

    tooltipLayer.attr(
        "transform",
        `translate(${d.x + r + gap}, ${d.y - TOOLTIP_FO_HEIGHT / 2})`
    );
}

function showTooltip(d) {
    if (!d || !tooltipLayer) return;
    fillTooltipContent(d);
    positionTooltip(d);
    tooltipLayer.classed("tooltip-layer--hidden", false);
}

function hideTooltip() {
    if (!tooltipLayer) return;
    tooltipLayer.classed("tooltip-layer--hidden", true);
}

function refreshTooltipPosition() {
    const nodeId = getActiveTooltipNodeId();
    if (!nodeId || !isTooltipVisible()) return;
    const node = getSimulationNode(nodeId);
    if (node) positionTooltip(node);
}

function clearTooltipHover() {
    tooltipHoverNodeId = null;
    if (tooltipPinnedNodeId) {
        const pinned = getSimulationNode(tooltipPinnedNodeId);
        if (pinned) showTooltip(pinned);
        else hideTooltip();
    } else {
        hideTooltip();
    }
}

svg.on("click", () => {
    tooltipPinnedNodeId = null;
    hideTooltip();
});

function updateGraphDimensions() {
    const size = getGraphSize();
    width = size.width;
    height = size.height;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
}

function resizeGraph() {
    if (!rawData || !currentEdgeField || !currentSizeField) return;
    updateGraphDimensions();
    renderGraph(currentEdgeField, currentSizeField);
}

let resizePending = false;
function scheduleResizeGraph() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
        resizePending = false;
        resizeGraph();
    });
}

new ResizeObserver(scheduleResizeGraph).observe(graphEl);
window.addEventListener("load", scheduleResizeGraph);

fetch("./graph.json")
    .then(res => res.json())
    .then(data => {
        rawData = data;

        const sampleNode = data.nodes[0];

        const numericFields = Object.keys(sampleNode)
            .filter(key => typeof sampleNode[key] === "number");

        const categoricalFields = Object.keys(sampleNode)
            .filter(key =>
                typeof sampleNode[key] === "string" ||
                Array.isArray(sampleNode[key])
            );

        buildGalery();
        buildSelectors(categoricalFields, numericFields);
        updateGraphDimensions();
        renderGraph(categoricalFields[3], numericFields[0]);
    });

let buildGaleryItem = (element) => {
    let li = document.createElement("li");
    let img = document.createElement("img");
    let label = document.createElement("span");

    li.classList.add("splide__slide");
    li.classList.add("gallery_item");
    li.dataset.nodeId = element.id;

    img.src = element.images[0];
    img.alt = element.id;

    label.textContent = element.id;
    label.classList.add("gallery_label");

    li.appendChild(img);
    li.appendChild(label);

    galleryList.appendChild(li);
}

function getNodeById(nodeId) {
    return rawData?.nodes.find(n => n.id === nodeId);
}

function goSplideShortest(targetIndex) {
    const current = splide.index;
    if (current === targetIndex) return;

    const len = splide.length;
    const forward = (targetIndex - current + len) % len;
    const backward = (current - targetIndex + len) % len;

    if (backward < forward) {
        splide.go(`-${backward}`);
    } else if (forward > 0) {
        splide.go(`+${forward}`);
    }
}

let splide;

let buildGalery = () => {
    rawData.nodes.forEach(e => buildGaleryItem(e));

    splide = new Splide('.splide', {
        type: 'loop',
        focus: 'center',
        speed: 2000,
        perPage: 10,
        perMove: 3,
        pagination: false,
        breakpoints: {
            1279: { perPage: 6 },
            1023: { perPage: 4 },
            767: { perPage: 3 },
        },
    });

    splide.mount();
    selectNode(rawData.nodes[14], { focusGraph: true });

    galleryList.addEventListener("click", (event) => {
        const item = event.target.closest(".gallery_item");
        if (!item?.dataset.nodeId) return;
        const node = getNodeById(item.dataset.nodeId);
        if (node) selectNode(node, { focusGraph: true });
    });
}

function buildSelectors(edgeFields, sizeFields) {
    const edgeSelector = document.getElementById("edgeSelector");
    const sizeSelector = document.getElementById("sizeSelector");

    edgeFields.forEach(field => {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = field;
        edgeSelector.appendChild(option);
    });

    sizeFields.forEach(field => {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = field;
        sizeSelector.appendChild(option);
    });

    edgeSelector.value = edgeFields[3];
    sizeSelector.value = sizeFields[0];

    edgeSelector.addEventListener("change", updateGraph);
    sizeSelector.addEventListener("change", updateGraph);
}

function updateGraph() {
    renderGraph(
        document.getElementById("edgeSelector").value,
        document.getElementById("sizeSelector").value
    );
}

function generateLinks(nodes, field) {
    const links = [];

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {

            const a = nodes[i][field];
            const b = nodes[j][field];

            let connected = false;

            if (Array.isArray(a) && Array.isArray(b)) {
                connected = a.some(v => b.includes(v));
            } else {
                connected = a === b;
            }

            if (connected) {
                links.push({
                    source: nodes[i].id,
                    target: nodes[j].id
                });
            }
        }
    }

    return links;
}

function renderGraph(edgeField, sizeField) {
    console.log(edgeField, sizeField);
    currentEdgeField = edgeField;
    currentSizeField = sizeField;
    updateGraphDimensions();

    svg.selectAll("*").remove();

    const nodes = structuredClone(rawData.nodes);

    const links = generateLinks(nodes, edgeField);

    const radiusScale = d3.scaleLinear()
        .domain(d3.extent(nodes, d => d[sizeField] || 1))
        .range([8, 36]);

    currentRadiusScale = radiusScale;

    simulation = d3.forceSimulation(nodes)
        .alphaDecay(0)
        .force("link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(90)
        )
        .force("charge", d3.forceManyBody().strength(-240))
        .force("center", d3.forceCenter(width / 2, height / 2));
        
    zoomGroup = svg.append("g");
    simulationNodes = nodes;

    zoomBehavior = d3.zoom()
        .scaleExtent([0.3, 4])
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        });

    svg.call(zoomBehavior);
    
    let initialTransform = d3.zoomIdentity.scale(0.8);
    svg.call(zoomBehavior.transform, initialTransform);

    const link = zoomGroup.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", "link");

    const node = zoomGroup.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => radiusScale(d[sizeField] || 1))
        .on("click", (event, d) => {
            event.stopPropagation();
            tooltipPinnedNodeId = d.id;
            tooltipHoverNodeId = d.id;
            showTooltip(d);
            selectNode(d);
        })
        .on("pointerenter", (_, d) => {
            tooltipHoverNodeId = d.id;
            showTooltip(d);
        })
        .on("pointerleave", () => {
            if (tooltipPinnedNodeId && tooltipHoverNodeId === tooltipPinnedNodeId) return;
            tooltipHoverNodeId = null;
            clearTooltipHover();
        })
        .call(
            d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
        );

    graphNodeSelection = node;

    tooltipLayer = zoomGroup.append("g")
        .attr("class", "tooltip-layer tooltip-layer--hidden")
        .style("pointer-events", "none");

    tooltipLayer.append("foreignObject")
        .attr("class", "tooltip-fo")
        .attr("width", TOOLTIP_FO_WIDTH)
        .attr("height", TOOLTIP_FO_HEIGHT)
        .append("xhtml:div")
        .attr("class", "graph-tooltip")
        .each(function () {
            tooltipContentEl = this;
        });

    if (selectedNodeId) {
        node.classed("selected", d => d.id === selectedNodeId);
    }

    simulation.on("tick", () => {
        nodes.forEach(d => {
            const r = radiusScale(d[sizeField] || 1) || 8; 
            
            if (d.x < r) { d.x = r; d.vx *= -1; }
            if (d.x > width - r) { d.x = width - r; d.vx *= -1; }
            
            if (d.y < r) { d.y = r; d.vy *= -1; }
            if (d.y > height - r) { d.y = height - r; d.vy *= -1; }
        });

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        refreshTooltipPosition();
    });

    if (tooltipPinnedNodeId) {
        const pinned = nodes.find(n => n.id === tooltipPinnedNodeId);
        if (pinned) showTooltip(pinned);
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();

        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);

        d.fx = null;
        d.fy = null;
    }
}

function getSimulationNode(nodeId) {
    return simulationNodes?.find(n => n.id === nodeId);
}

function focusNodeOnGraph(nodeId) {
    if (!zoomBehavior || !svg.node()) return;

    const tryFocus = () => {
        const node = getSimulationNode(nodeId);
        if (!node || node.x == null || node.y == null) {
            requestAnimationFrame(tryFocus);
            return;
        }

        const currentTransform = d3.zoomTransform(svg.node());
        const scale = Math.max(currentTransform.k, 1);

        const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-node.x, -node.y);

        svg.transition()
            .duration(800)
            .ease(d3.easeCubicInOut)
            .call(zoomBehavior.transform, transform);
    };

    tryFocus();
}

function selectNode(nodeData, { focusGraph = false } = {}) {
    console.log(nodeData);
    if (!nodeData) return;

    selectedNodeId = nodeData.id;

    if (graphNodeSelection) {
        graphNodeSelection.classed("selected", d => d.id === selectedNodeId);
    }

    document.querySelectorAll(".gallery_item").forEach(li => {
        li.classList.toggle(
            "gallery_item--selected",
            li.dataset.nodeId === selectedNodeId
        );
    });

    if (splide) {
        const slideIndex = rawData.nodes.findIndex(n => n.id === selectedNodeId);
        if (slideIndex >= 0) goSplideShortest(slideIndex);
    }

    updateInfoBox(nodeData);

    if (focusGraph) {
        focusNodeOnGraph(selectedNodeId);
    }
}

function renderSaborTags(sabor) {
    const container = document.getElementById("sabor_tags");
    container.replaceChildren();

    const flavors = Array.isArray(sabor)
        ? sabor
        : sabor
            ? [sabor]
            : [];

    flavors.forEach(value => {
        const text = String(value).trim();
        if (!text) return;

        const tag = document.createElement("span");
        tag.className = "flavor_tag";
        tag.textContent = text;
        container.appendChild(tag);
    });
}

function updateInfoSubtitle(id) {
    const subtitle = document.getElementById("info_subtitle");
    subtitle.classList.remove("reveal");
    subtitle.textContent = id ?? "";
    void subtitle.offsetWidth;
    subtitle.classList.add("reveal");
}

let updateInfoBox = (e) => {
    updateInfoSubtitle(e.id);

    let scientificName = document.getElementById("cientific_name");
    let origin = document.getElementById("origin");
    let otherNames = document.getElementById("other_names");
    let sensoryCharacteristics = document.getElementById("sensory_characteristics");
    let price = document.getElementById("price");
    let gastronomicApplications = document.getElementById("gastronomic_applications");

    renderSaborTags(e.sabor);

    scientificName.innerText = e.scientific_name ?? "";
    origin.innerText = e.origin ?? "";
    otherNames.innerText = e.other_names ?? "";
    sensoryCharacteristics.innerText = e.sensory_characteristics ?? "";
    price.innerText = e.price ?? "";
    gastronomicApplications.innerText = e.gastronomic_application ?? "";
}
