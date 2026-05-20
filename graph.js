let rawData;
let simulation;

const graphRect = document.getElementById("graph").getBoundingClientRect()

const width = graphRect.width;
const height = graphRect.height;

const svg = d3
    .select("#graph")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = document.getElementById("tooltip");
const galleryList = document.getElementById("gallery_list");

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
        renderGraph(categoricalFields[0], numericFields[0]);
    });

let buildGaleryItem = (element) => {
    let li = document.createElement("li");
    let img = document.createElement("img");
    let label = document.createElement("span");

    li.classList.add("splide__slide");
    li.classList.add("gallery_item");

    img.src = element.images[0];

    label.textContent = element.id;
    label.classList.add("gallery_label");

    li.appendChild(img);
    li.appendChild(label);

    galleryList.appendChild(li);
}

let buildGalery = () => {
    rawData.nodes.forEach(e => buildGaleryItem(e));

    let splide = new Splide('.splide', {
        type: 'loop',
        perPage: 9,
        perMove: 1
    });

    splide.mount();
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
    svg.selectAll("*").remove();

    const nodes = structuredClone(rawData.nodes);

    const links = generateLinks(nodes, edgeField);

    const radiusScale = d3.scaleLinear()
        .domain(d3.extent(nodes, d => d[sizeField] || 1))
        .range([8, 36]);

    simulation = d3.forceSimulation(nodes)
        .force("link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(90)
        )
        .force("charge", d3.forceManyBody().strength(-240))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const zoomGroup = svg.append("g");

    svg.call(
        d3.zoom()
            .scaleExtent([0.3, 4])
            .on("zoom", (event) => {
                zoomGroup.attr("transform", event.transform);
            })
    );

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
        .attr("fill", "rgba(61, 61, 61, 0.8)")
        .on("click", (_, d) => updateInfoBox(d))
        .on("mousemove", (event, d) => {
            tooltip.style.opacity = 1;
            tooltip.style.left = event.pageX + 16 + "px";
            tooltip.style.top = event.pageY + 16 + "px";

            tooltip.innerHTML = `
            <strong>${d.name || d.id}</strong>
          `;
        })
        .on("mouseleave", () => {
            tooltip.style.opacity = 0;
        })
        .call(
            d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
        );

    simulation.on("tick", () => {

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

    });

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

let updateInfoBox = (e) => {
    console.log(e);
    let scientificName = document.getElementById("cientific_name");
    let origin = document.getElementById("origin");
    let otherNames = document.getElementById("other_names");
    let sensoryCharacteristics = document.getElementById("sensory_characteristics");
    let price = document.getElementById("price");
    let gastronomicApplications = document.getElementById("gastronomicApplications");

    scientificName.innerText = e.scientific_name;
    origin.innerText = e.origin;
    otherNames.innerText = e.other_names;
    sensoryCharacteristics.innerText = e.sensory_characteristics;
    price.innerText = e.price;
    gastronomicApplications.innerText = e.gastronomic_applications;

}