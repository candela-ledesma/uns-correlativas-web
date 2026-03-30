function construirGrafo(materias){

  const nodes = materias.map(m => ({
    data: {
      id: String(m.id),
      label: m.nombre
    }
  }));

  const edges = [];

  materias.forEach(m=>{
    for(const corId in (m.correlativas || {})){
      edges.push({
        data:{
          source: String(corId),
          target: String(m.id)
        }
      });
    }
  });

  return {nodes, edges};
}

function crearVisualizacion(materias){

  const {nodes, edges} = construirGrafo(materias);

  const cy = cytoscape({
    container: document.getElementById('grafo'),

    elements: [
      ...nodes,
      ...edges
    ],

    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'background-color': '#666',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#fff',
          'font-size': '10px',
          'width': '40px',
          'height': '40px'
        }
      },

      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }
    ],

    layout: {
      name: 'breadthfirst',
      directed: true,
      padding: 10
    }

  });

}