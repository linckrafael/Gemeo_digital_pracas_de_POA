    // LÓGICA DO ARCGIS (Mapa 3D)
    require([
      "esri/Map",
      "esri/views/SceneView",
      "esri/Graphic",
      "esri/layers/GraphicsLayer",
      "esri/widgets/BasemapGallery",
      "esri/layers/GeoJSONLayer",
      "esri/layers/FeatureLayer"
    ], function(Map, SceneView, Graphic, GraphicsLayer, BasemapGallery, GeoJSONLayer, FeatureLayer) {

      // Camada configurada para permitir elevação no relevo 3D
      const graphicsLayer = new GraphicsLayer({
        elevationInfo: {
          mode: "relative-to-ground"
        }
      });

      // --- NOVO: Camada LOCAL de Praças e Parques (Lê o teu GeoJSON) ---
      const pracasLayer = new GeoJSONLayer({
        url: "./Praças_e_Parques_Municipais.geojson", // Aponta para o teu ficheiro na pasta
        id: "pracas-parques",
        title: "Praças e Parques",
        visible: true,
        outFields: ["*"],
        // Mantemos o teu estilo verde perfeitamente igual
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [34, 197, 94, 0.4], 
            outline: { color: [21, 128, 61, 1], width: 1.5 }
          }
        }
      });

      const map = new Map({
        basemap: "topo-3d",
        ground: "world-elevation",
        layers: [graphicsLayer, pracasLayer]
      });

      // --- AJUSTE DE CÂMERA AQUI ---
      // Pointing the camera precisely at the broken bench location on load.
      const view = new SceneView({
        container: "mapa-container",
        map: map,
        padding: { top: 72 }, 
        camera: {
          // Point close to the object, looking from south to north
          position: [-51.144417, -30.200719, 30000], // Longitude, Latitude, Altitude
          tilt: 30, // Inclinação 3D
          heading: 0 // Apontando para o Norte
        },
        popup: {
          dockEnabled: false,
          dockOptions: { buttonEnabled: false, breakpoint: false },
          visibleElements: {
            closeButton: false,       // Esconde o botão "X"
            collapseButton: false,    // Esconde o botão de minimizar
            featureNavigation: false, // Esconde as setas de paginação
            actionBar: false          // Esconde a barra preta de ações no rodapé
          }
        }
      });
      

      // Renderiza a galeria de mapas no painel lateral
  const basemapGallery = new BasemapGallery({
    view: view,
    container: "basemap-gallery-container"
  });

// A mágica só acontece quando o mapa estiver 100% pronto
      view.when(function() {
        
      // --- CONEXÃO COM O BANCO DE DADOS NA NUVEM (ARCGIS ONLINE) ---
        const urlMinhaCamada = "https://gis-smamus.portoalegre.rs.gov.br/server/rest/services/Hosted/Mobili%C3%A1rio_urbano_das_pra%C3%A7as/FeatureServer/0"; 
        
        window.camadaItensNuvem = new FeatureLayer({
           url: urlMinhaCamada,
           outFields: ["*"]
        });

        window.bancoDeDadosItens = []; // Começa vazio

        // --- MOTORES DE SINCRONIZAÇÃO COM A NUVEM ---
        window.sincronizarAdicaoNuvem = function(novoItem, geometriaExata) {
          const graphicNovo = new Graphic({
            geometry: geometriaExata,
            attributes: {
              praca_id: novoItem.praca,
              nome: novoItem.nome,
              arquivo_glb: novoItem.arquivo_glb,
              status: novoItem.status,
              escala: novoItem.escala,
              rotacao: novoItem.rotacao,
              altitude: novoItem.altitude,
              inclinacao: novoItem.inclinacao || 0 
            }
          });
          graphicNovo.geometry.z = novoItem.altitude || 0;
          
          window.camadaItensNuvem.applyEdits({ addFeatures: [graphicNovo] }).then(function(resultado) {
            if (resultado.addFeatureResults.length > 0 && resultado.addFeatureResults[0].objectId) {
              const idOficial = resultado.addFeatureResults[0].objectId;
              novoItem.objectId = idOficial;
              novoItem.id = idOficial; 
              console.log("🟢 Salvo na nuvem com ID:", idOficial);
              
              if (pracaAtivaId === novoItem.praca) window.atualizarInterfaceEMapa();
            } else if (resultado.addFeatureResults.length > 0 && resultado.addFeatureResults[0].error) {
              console.error("🔴 Servidor rejeitou adição:", resultado.addFeatureResults[0].error);
            }
          }).catch(err => console.error("🔴 Erro de rede:", err));
        };

        window.sincronizarAtualizacaoNuvem = function(item, geometriaNova = null) {
          if (!item.objectId) return; 
          
          const nomeColunaId = window.camadaItensNuvem.objectIdField || "OBJECTID";
          const atributosEdicao = {
              praca_id: item.praca,
              nome: item.nome,
              arquivo_glb: item.arquivo_glb,
              status: item.status,
              escala: item.escala,
              rotacao: item.rotacao,
              altitude: item.altitude,
              inclinacao: item.inclinacao || 0 // <--- NOVO
          };
          atributosEdicao[nomeColunaId] = item.objectId;

          const graphicEditado = { attributes: atributosEdicao };
          
          // MÁGICA: Só envia geometria se você "MOVER" o objeto. Isso impede o servidor de rejeitar as outras edições!
          if (geometriaNova) {
              graphicEditado.geometry = geometriaNova;
              graphicEditado.geometry.z = item.altitude || 0;
          }

          window.camadaItensNuvem.applyEdits({ updateFeatures: [graphicEditado] }).then((res) => {
             if(res.updateFeatureResults.length > 0 && res.updateFeatureResults[0].error) {
                 console.error("🔴 Servidor rejeitou atualização:", res.updateFeatureResults[0].error);
             } else {
                 console.log("🔵 Atualizado na nuvem!");
             }
          }).catch(err => console.error("🔴 Erro de rede:", err));
        };

        window.sincronizarDelecaoNuvem = function(objectId) {
          if (!objectId) return;
          
          // O comando deleteFeatures exige que a propriedade se chame rigidamente "objectId"
          window.camadaItensNuvem.applyEdits({ 
              deleteFeatures: [{ objectId: objectId }] 
          }).then((res) => {
             if(res.deleteFeatureResults.length > 0 && res.deleteFeatureResults[0].error) {
                 console.error("🔴 Servidor rejeitou deleção:", res.deleteFeatureResults[0].error);
             } else {
                 console.log("🟠 Deletado da nuvem com sucesso!");
             }
          }).catch(err => console.error("🔴 Erro de rede na deleção:", err));
        };

        // Suga os dados da nuvem assim que o mapa abre
        window.camadaItensNuvem.queryFeatures({ where: "1=1", outFields: ["*"], returnGeometry: true }).then(function(results) {
           
           window.bancoDeDadosItens = results.features.map(f => {
              // Busca o ID oficial ignorando se está em maiúsculo ou minúsculo no servidor da prefeitura
              let idReal = null;
              for (const key in f.attributes) {
                  if (key.toLowerCase() === 'objectid' || key.toLowerCase() === 'fid') {
                      idReal = f.attributes[key];
                      break;
                  }
              }
              // Se por algum milagre não achar, cria um de segurança para não travar
              idReal = idReal || f.attributes.OBJECTID || Math.floor(Math.random() * 1000000);
              
              return {
                 objectId: idReal,
                 id: idReal, // Agora cada objeto terá sua própria identidade blindada!
                 praca: f.attributes.praca_id,
                 nome: f.attributes.nome,
                 arquivo_glb: f.attributes.arquivo_glb,
                 status: f.attributes.status,
                 escala: f.attributes.escala || 1,
                 rotacao: f.attributes.rotacao || 0,
                 altitude: f.attributes.altitude || 0,
                 inclinacao: f.attributes.inclinacao || 0, 
                 lon: f.geometry.longitude || f.geometry.x, 
                 lat: f.geometry.latitude || f.geometry.y,
                 geometriaOriginal: f.geometry // A MÁGICA: Guarda o formato geométrico oficial da prefeitura
              };
           });
           console.log(`✅ Sucesso: ${window.bancoDeDadosItens.length} itens carregados da nuvem!`);
           
           if (pracaAtivaId) window.atualizarInterfaceEMapa();
        }).catch(erro => console.error("🔴 Erro ao ler da nuvem:", erro));

        // --- BANCO DE DADOS FICTÍCIO DE OBRAS (Restaurado) ---
        window.bancoDeDadosObras = [
          { id: 1, praca: "Matriz", local: "Praça da Matriz", titulo: "Revitalização do Calçamento", descricao: "Troca de pavimentação das calçadas com blocos de concreto intertravado.", status: "Em Execução", porcentagem: 45, data: "2026-06-15", lon: -51.2305, lat: -30.0338 },
          { id: 2, praca: "Carlesso", local: "Praça Antônio Carlesso", titulo: "Reforma Esportiva e Paisagismo", descricao: "Reforma completa da quadra esportiva, pintura do alambrado e plantio de mudas.", status: "Planejado", porcentagem: 0, data: "2026-08-01", lon: -51.194719, lat: -29.984137 },
          { id: 3, praca: "Redencao", local: "Parque Farroupilha", titulo: "Manutenção Playground", descricao: "Manutenção estrutural dos brinquedos do playground principal e troca de areia.", status: "Concluído", porcentagem: 100, data: "2026-05-10", lon: -51.2185, lat: -30.0355 }
        ];

        // --- VARIÁVEIS DE CONTROLE DE ESTADO (Recuperadas) ---
        let pracaAtivaId = null;
        let modoInteracaoMapa = null; 
        let idItemSendoMovido = null;
        let idMenu3DAberto = null;

        // --- FUNÇÃO UNIFICADORA DE ID E NOME DE PRAÇAS ---
        function extrairIdENomePraca(attr) {
          const nomeOriginal = attr.denominaç || attr.denomina_1 || "Praça sem nome";
          // Garante um ID estável usando as colunas do GeoJSON
          let idFinal = attr.cod || attr.OBJECTID || attr.FID || attr.fid || "sem-id";
          let nomeFinal = nomeOriginal;

          const nomeMin = nomeOriginal.toLowerCase();
          // Mantém os IDs fixos que conversam com o seu banco de obras fictício
          if (nomeMin.includes("matriz")) { idFinal = "Matriz"; nomeFinal = "Praça da Matriz"; }
          else if (nomeMin.includes("alfândega") || nomeMin.includes("alfandega")) { idFinal = "Alfandega"; nomeFinal = "Praça da Alfândega"; }
          else if (nomeMin.includes("farroupilha") || nomeMin.includes("redenção")) { idFinal = "Redencao"; nomeFinal = "Parque Farroupilha (Redenção)"; }
          else if (nomeMin.includes("carlesso")) { idFinal = "Carlesso"; nomeFinal = "Praça Antônio Carlesso"; }

          return { id: idFinal.toString(), nome: nomeFinal };
        }

        // --- NOVO: LER TODAS AS PRAÇAS DO ARQUIVO PARA A LISTA ---
        window.todasAsPracas = [];
        
        pracasLayer.when(() => {
          const query = pracasLayer.createQuery();
          query.where = "1=1"; 
          query.outFields = ["*"];
          query.returnGeometry = true;
          
          pracasLayer.queryFeatures(query).then(function(results) {
            window.todasAsPracas = results.features.map(f => {
              const attr = f.attributes;
              const lon = f.geometry.extent ? f.geometry.extent.center.longitude : -51.2;
              const lat = f.geometry.extent ? f.geometry.extent.center.latitude : -30.0;
              
              const infoPraca = extrairIdENomePraca(attr);

              return {
                nome: infoPraca.nome,
                bairro: attr.bairro_ofi || "Bairro não informado",
                endereco: attr.endereço_ || attr.endereço1 || "Endereço não informado",
                lon: lon,
                lat: lat,
                idOficial: infoPraca.id,
                bancos: attr.banco || attr.bancos || "",
                lixeiras: attr.lixeira || attr.lixeiras || "",
                iluminacao: attr.iluminaç || "",
                ambientes: attr.ambientes || "",
                bebedouros: attr.bebedouro || 0,
                // --- OS NOVOS ITENS ESCONDIDOS DA PREFEITURA ---
                vestiarios: attr.vestiário || 0,
                monumentos: attr.monumentos || "",
                cercamento: attr.cercamento || "",
                pistaPatinacao: attr.pista_de_p || 0,
                irrigacao: attr.irrigaçã || 0,
                elementos: attr.elementos || "",
                equipDiversos: attr.equip_dive || "",
                geometriaPoligono: f.geometry,
                extent: f.geometry.extent
              };
            });
            
            window.todasAsPracas.sort((a, b) => a.nome.localeCompare(b.nome));
            renderizarListaPracas();
          });
        });

        // --- SISTEMA DE RENDERIZAÇÃO E FILTRO DA LISTA ---
        window.renderizarListaPracas = function(termo = "") {
          const divLista = document.getElementById('lista-pracas-dinamica');
          divLista.innerHTML = '';
          
          const termoMin = termo.toLowerCase();
          
          // Filtra a lista pelo termo digitado (Busca no Nome, Bairro ou Endereço)
          const filtradas = window.todasAsPracas.filter(p => 
            p.nome.toLowerCase().includes(termoMin) || 
            p.bairro.toLowerCase().includes(termoMin) || 
            p.endereco.toLowerCase().includes(termoMin)
          );
          
          // Limita a 50 resultados na tela para o painel não travar de tanta praça
          const limite = filtradas.slice(0, 50);
          
          if (limite.length === 0) {
            divLista.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma praça encontrada com este termo.</p>';
            return;
          }
          
          limite.forEach(p => {
            const nomeSeguro = p.nome.replace(/'/g, "\\'");
            const idSeguro = p.idOficial.toString().replace(/'/g, "\\'");

            divLista.innerHTML += `
              <div class="w-full flex justify-between items-center p-3 rounded-xl border border-gray-200 bg-white hover:bg-green-50 hover:border-green-300 transition shadow-sm group">
                <div onclick="abrirGestaoPraca('${idSeguro}', '${nomeSeguro}', ${p.lon}, ${p.lat})" class="cursor-pointer flex-1">
                  <h3 class="font-bold text-gray-800 text-sm group-hover:text-green-700 transition leading-tight">${p.nome}</h3>
                  <p class="text-[10px] text-gray-400 mt-1 line-clamp-1">📍 ${p.endereco} — <span class="font-semibold text-gray-500">${p.bairro}</span></p>
                </div>
                <button onclick="voarParaPraca(${p.lon}, ${p.lat})" class="bg-gray-100 hover:bg-green-600 hover:text-white text-gray-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition ml-2 shadow-sm" title="Ir para a praça">
                  Ir 
                </button>
              </div>
            `;
          });
        };

        // Adiciona a função de voo para o botão da lista funcionar
        window.voarParaPraca = function(lon, lat) {
          view.goTo({ target: [lon, lat], zoom: 19.5, tilt: 45 }, { duration: 2000 });
        };
        
        // --- 1. BUSCA GLOBAL NO CABEÇALHO ---
        const inputGlobal = document.getElementById('input-pesquisa-global');
        if (inputGlobal) {
          inputGlobal.addEventListener('input', (e) => {
            const termo = e.target.value;
            renderizarListaPracas(termo);
            
            // Espelha o texto para a barra da gaveta
            const inputLocal = document.getElementById('input-pesquisa-local');
            if (inputLocal) inputLocal.value = termo;
            
            if (termo.trim() !== "") {
                const contentInventario = document.getElementById('content-inventario');
                if (contentInventario && contentInventario.classList.contains('hidden')) {
                    const btnInv = document.getElementById('btn-inventario');
                    if (btnInv) btnInv.click();
                }
                const telaGestao = document.getElementById('tela-gestao-praca');
                if (telaGestao && !telaGestao.classList.contains('hidden')) {
                    window.voltarParaListaPracas();
                }
            }
          });
        }

        // --- 2. BUSCA LOCAL DENTRO DA GAVETA ---
        const inputLocal = document.getElementById('input-pesquisa-local');
        if (inputLocal) {
          inputLocal.addEventListener('input', (e) => {
            const termo = e.target.value;
            renderizarListaPracas(termo);
            
            // Espelha o texto para a barra do cabeçalho
            const inputGlob = document.getElementById('input-pesquisa-global');
            if (inputGlob) inputGlob.value = termo;
          });
        }

        // --- NAVEGAÇÃO DO PAINEL DE INVENTÁRIO (Recuperadas) ---
        window.abrirGestaoPraca = function(idPraca, nomePraca, lon, lat) {
          pracaAtivaId = idPraca;
          document.getElementById('tela-lista-pracas').classList.add('hidden');
          document.getElementById('tela-gestao-praca').classList.remove('hidden');
          document.getElementById('titulo-praca-ativa').innerText = nomePraca;
          
          view.goTo({ target: [lon, lat], zoom: 19.5, tilt: 45 }, { duration: 2000 });
          window.atualizarInterfaceEMapa();
        };

        window.voltarParaListaPracas = function() {
          pracaAtivaId = null;
          cancelarAcaoMapa();
          graphicsLayer.removeAll();
          document.getElementById('tela-lista-pracas').classList.remove('hidden');
          document.getElementById('tela-gestao-praca').classList.add('hidden');
          document.getElementById('lista-obras-dinamica').innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Selecione uma praça no Inventário para filtrar as obras.</p>';
        };
        // Auxiliar para as cores dinâmicas dos status
        function obterCorStatusObra(status) {
          if (status === "Planejado") return "bg-blue-100 text-blue-800 border-blue-200";
          if (status === "Em Execução") return "bg-amber-100 text-amber-800 border-amber-200";
          if (status === "Concluído") return "bg-green-100 text-green-700 border-green-200";
          return "bg-gray-100 text-gray-800 border-gray-200";
        }

       // --- NOVA FUNÇÃO: VOA PARA A OBRA SEM ABRIR A EDIÇÃO ---
        window.voarParaObra = function(lon, lat, event) {
          event.stopPropagation(); // A mágica: Impede que o clique abra a tela de edição do card
          view.goTo({ 
            target: [lon, lat], 
            zoom: 19.5, 
            tilt: 45 
          }, { 
            duration: 2000 
          });
        };

        // --- SISTEMA CRUD DO PAINEL DE OBRAS ---
        window.renderizarPainelObras = function() {
          const divObras = document.getElementById('lista-todas-obras');
          divObras.innerHTML = '';

          window.bancoDeDadosObras.forEach(obra => {
            const cor = obterCorStatusObra(obra.status);
            divObras.innerHTML += `
              <div onclick="abrirEdicaoObra(${obra.id})" class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition group">
                <div class="flex justify-between items-start mb-1">
                  <h3 class="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition w-3/4 leading-tight">${obra.titulo}</h3>
                  <span class="px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${cor}">${obra.status}</span>
                </div>
                <div class="text-[11px] text-gray-500 mb-2 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span>📍 ${obra.local}</span>
                    <span>📅 ${obra.data.split('-').reverse().join('/')}</span>
                  </div>
                  <button onclick="voarParaObra(${obra.lon}, ${obra.lat}, event)" class="bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 text-[10px] font-bold px-2 py-1 rounded transition" title="Voar até a obra">
                    Ir
                  </button>
                </div>
                <p class="text-xs text-gray-600 mb-3 line-clamp-2">${obra.descricao}</p>
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                  <div class="bg-blue-500 h-2 rounded-full transition-all duration-500" style="width: ${obra.porcentagem}%"></div>
                </div>
                <p class="text-[10px] text-right mt-1 font-bold text-gray-500">${obra.porcentagem}% Concluído</p>
              </div>
            `;
          });
        };

        window.abrirEdicaoObra = function(id) {
          const obra = window.bancoDeDadosObras.find(o => o.id === id);
          if(obra) {
            document.getElementById('tela-lista-obras').classList.add('hidden');
            document.getElementById('tela-edicao-obra').classList.remove('hidden');

            document.getElementById('edit-obra-id').value = obra.id;
            document.getElementById('edit-obra-titulo').value = obra.titulo;
            document.getElementById('edit-obra-status').value = obra.status;
            document.getElementById('edit-obra-progresso').value = obra.porcentagem;
            document.getElementById('edit-obra-data').value = obra.data;
            document.getElementById('edit-obra-desc').value = obra.descricao;
          }
        };

        window.voltarParaListaObras = function() {
          document.getElementById('tela-lista-obras').classList.remove('hidden');
          document.getElementById('tela-edicao-obra').classList.add('hidden');
        };

        window.salvarEdicaoObra = function() {
          const id = parseInt(document.getElementById('edit-obra-id').value);
          const obra = window.bancoDeDadosObras.find(o => o.id === id);
          
          if(obra) {
            obra.titulo = document.getElementById('edit-obra-titulo').value;
            obra.status = document.getElementById('edit-obra-status').value;
            obra.porcentagem = document.getElementById('edit-obra-progresso').value;
            obra.data = document.getElementById('edit-obra-data').value;
            obra.descricao = document.getElementById('edit-obra-desc').value;
            
            voltarParaListaObras();
            renderizarPainelObras(); // Atualiza painel de obras
            
            // Se a obra for da mesma praça que está aberta no inventário, atualiza lá também!
            if(pracaAtivaId === obra.praca) {
              atualizarInterfaceEMapa();
            }
          }
        };

        // Chama a função uma vez no início para deixar a lista de obras já montada
        renderizarPainelObras();

        // --- ATUALIZAR MAPA E LISTA LATERAL DO INVENTÁRIO (CORRIGIDO E UNIFICADO) ---
        window.atualizarInterfaceEMapa = function() {
          graphicsLayer.removeAll();
          const divLista = document.getElementById('lista-itens-dinamica');
          divLista.innerHTML = '';

          // RECUPERADO: Linha vital que filtra os itens cadastrados nesta praça ativa
          const itensDaPraca = window.bancoDeDadosItens.filter(i => i.praca === pracaAtivaId);

          // Lógica de Renderização de Obras e Inventário Oficial
          const divStatusObra = document.getElementById('status-obra-praca');
          let painelSuperiorHTML = '';

          // 1. Verifica se tem OBRA acontecendo (Banco de Dados Fictício)
          const obraDaPraca = window.bancoDeDadosObras.find(o => o.praca === pracaAtivaId);
          if (obraDaPraca) {
            const cor = obterCorStatusObra(obraDaPraca.status);
            painelSuperiorHTML += `
              <div class="p-3 rounded-xl border text-xs shadow-sm mb-3 ${cor}">
                <div class="flex justify-between items-center mb-1">
                  <strong>🚧 ${obraDaPraca.status}</strong>
                  <span class="font-bold">${obraDaPraca.porcentagem}%</span>
                </div>
                <div class="font-semibold text-[13px] mb-1">${obraDaPraca.titulo}</div>
                <div class="text-[11px] opacity-80 line-clamp-1">${obraDaPraca.descricao}</div>
              </div>
            `;
          }

          // 2. Puxa os dados oficiais de inventário do arquivo GEOJSON
          const pracaGeo = window.todasAsPracas.find(p => p.idOficial === pracaAtivaId);
          if (pracaGeo) {
            const temDado = (valor) => valor && valor.toString().trim() !== "" && valor.toString().trim() !== "0" && valor.toString().trim() !== "Não informado";
            
            if (temDado(pracaGeo.bancos) || temDado(pracaGeo.lixeiras) || temDado(pracaGeo.iluminacao) || temDado(pracaGeo.ambientes)) {
              painelSuperiorHTML += `
                <div class="bg-blue-50/50 p-3 rounded-xl border border-blue-200 shadow-sm mb-4">
                  <div class="flex justify-between items-start mb-2">
                    <h4 class="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">📋 Inventário Oficial</h4>
                    <button onclick="autoGerarMobiliario('${pracaGeo.idOficial}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow transition flex items-center gap-1">
                      🪄 Auto-Gerar 3D
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-[10px] text-gray-700">
                    ${temDado(pracaGeo.bancos) ? `<div><strong class="text-gray-900">🪑 Bancos:</strong> ${pracaGeo.bancos}</div>` : ''}
                    ${temDado(pracaGeo.lixeiras) ? `<div><strong class="text-gray-900">🗑️ Lixeiras:</strong> ${pracaGeo.lixeiras}</div>` : ''}
                    ${temDado(pracaGeo.iluminacao) ? `<div><strong class="text-gray-900">💡 Iluminação:</strong> ${pracaGeo.iluminacao}</div>` : ''}
                    ${temDado(pracaGeo.bebedouros) ? `<div><strong class="text-gray-900">💧 Bebedouros:</strong> ${pracaGeo.bebedouros}</div>` : ''}
                    ${temDado(pracaGeo.vestiarios) ? `<div><strong class="text-gray-900">🚻 Vestiários:</strong> ${pracaGeo.vestiarios}</div>` : ''}
                    ${temDado(pracaGeo.pistaPatinacao) ? `<div><strong class="text-gray-900">⛸️ Pista Patinação:</strong> ${pracaGeo.pistaPatinacao}</div>` : ''}
                    ${temDado(pracaGeo.irrigacao) ? `<div><strong class="text-gray-900">🚿 Irrigação:</strong> Sim</div>` : ''}
                    ${temDado(pracaGeo.cercamento) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">🚧 Cercamento:</strong> ${pracaGeo.cercamento}</div>` : ''}
                    ${temDado(pracaGeo.monumentos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">🗽 Monumentos:</strong> ${pracaGeo.monumentos}</div>` : ''}
                    ${temDado(pracaGeo.equipDiversos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">➕ Outros Equip.:</strong> ${pracaGeo.equipDiversos}</div>` : ''}
                    ${temDado(pracaGeo.elementos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">🧱 Elementos:</strong> ${pracaGeo.elementos}</div>` : ''}
                    ${temDado(pracaGeo.ambientes) ? `<div class="col-span-2 mt-1 pt-1 border-t border-blue-100"><strong class="text-gray-900">🌳 Ambientes:</strong> ${pracaGeo.ambientes}</div>` : ''}
                  </div>
                </div>
              `;
            }
          }

          divStatusObra.innerHTML = painelSuperiorHTML;

          // LOOP: Desenha os GLBs e cria os Cards
          itensDaPraca.forEach(item => {
            
            // 1. Desenha o seu Modelo GLB (Blindado contra itens normais e auto-gerados)
            let geoItem;
            if (item.geometriaOriginal && typeof item.geometriaOriginal.clone === 'function') {
              geoItem = item.geometriaOriginal.clone();
            } else {
              geoItem = { type: "point", longitude: item.lon, latitude: item.lat, spatialReference: { wkid: 4326 } };
            }
            geoItem.z = item.altitude || 0;

            const modeloGrafico = new Graphic({
              geometry: geoItem, 
              attributes: { idVisual: item.id, nome: item.nome, status: item.status, escala: item.escala || 1, tipo: "modelo" }, // NOVO: idVisual
              symbol: criarSimboloGLB(item.arquivo_glb || 'low_poly_-_park_bench.glb', item.escala || 1, item.rotacao || 0, item.inclinacao || 0) // NOVO: inclinacao
            });
            graphicsLayer.add(modeloGrafico);

            // --- INDICADOR VISUAL SUTIL ---
            if (item.status === "Necessita Conserto") {
              const alturaLevitacao = (item.altitude || 0) + (3 * (item.escala || 1)) + 0.5;
              const geoAlerta = (geoItem.clone && typeof geoItem.clone === 'function') ? geoItem.clone() : { type: "point", longitude: item.lon, latitude: item.lat, spatialReference: { wkid: 4326 } };
              geoAlerta.z = alturaLevitacao;
              
              const alertaGrafico = new Graphic({
                geometry: geoAlerta, 
                attributes: { nome: item.nome, status: item.status, tipo: "alerta" },
                symbol: {
                  type: "point-3d",
                  symbolLayers: [{
                    type: "object",
                    resource: { primitive: "sphere" }, 
                    material: { color: "#ef4444" }, 
                    height: 0.25, width: 0.25
                  }]
                }
              });
              graphicsLayer.add(alertaGrafico);
            }

            // 2. Monta o card com o Menu 3D embutido
            divLista.innerHTML += `
              <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm mt-3">
                <div class="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-gray-800">${item.nome}</span>
                    <button onclick="editarNomeItem(${item.id})" class="text-gray-400 hover:text-blue-600 transition" title="Editar Nome">✏️</button>
                    <button onclick="toggleMenu3D(${item.id})" class="${idMenu3DAberto === item.id ? 'text-purple-600' : 'text-gray-400'} hover:text-purple-600 transition" title="Ajustes 3D">⚙️</button>
                  </div>
                  <button onclick="deletarItem(${item.id})" class="text-red-400 hover:text-red-600 transition" title="Excluir">🗑️</button>
                </div>
                
                <div class="flex items-center gap-2">
                  <button onclick="mudarStatus(${item.id})" class="text-xs font-semibold px-2 py-1 rounded-lg transition ${item.status === 'OK' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}" title="Mudar Status">
                    ${item.status} ↻
                  </button>
                  <button onclick="ativarModoMover(${item.id})" class="text-xs font-semibold px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition" title="Mover no Mapa">
                    📍 Mover
                  </button>
                </div>

                <div class="${idMenu3DAberto === item.id ? 'block' : 'hidden'} mt-3 pt-3 border-t border-gray-200 space-y-3 animate-fade-in">
                  
                  <div class="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-[10px] font-bold text-gray-500">TAMANHO</span>
                      <span class="text-[10px] text-gray-400 font-mono" id="val-escala-${item.id}">${(item.escala || 1).toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.1" max="5" step="0.05" value="${item.escala || 1}" 
                           oninput="aplicarAjuste3D(${item.id}, 'escala', this.value, false)" 
                           onchange="aplicarAjuste3D(${item.id}, 'escala', this.value, true)"
                           class="w-full accent-purple-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                  </div>

                  <div class="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-[10px] font-bold text-gray-500">GIRO HORIZONTAL</span>
                      <span class="text-[10px] text-gray-400 font-mono" id="val-rotacao-${item.id}">${item.rotacao || 0}°</span>
                    </div>
                    <input type="range" min="0" max="360" step="1" value="${item.rotacao || 0}" 
                           oninput="aplicarAjuste3D(${item.id}, 'rotacao', this.value, false)" 
                           onchange="aplicarAjuste3D(${item.id}, 'rotacao', this.value, true)"
                           class="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                  </div>

                  <div class="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-[10px] font-bold text-gray-500">INCLINAÇÃO NO TERRENO</span>
                      <span class="text-[10px] text-gray-400 font-mono" id="val-inclinacao-${item.id}">${item.inclinacao || 0}°</span>
                    </div>
                    <input type="range" min="-90" max="90" step="1" value="${item.inclinacao || 0}" 
                           oninput="aplicarAjuste3D(${item.id}, 'inclinacao', this.value, false)" 
                           onchange="aplicarAjuste3D(${item.id}, 'inclinacao', this.value, true)"
                           class="w-full accent-orange-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                  </div>

                  <div class="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-[10px] font-bold text-gray-500">ALTURA (Elevação)</span>
                      <span class="text-[10px] text-gray-400 font-mono" id="val-altitude-${item.id}">${(item.altitude || 0).toFixed(1)}m</span>
                    </div>
                    <input type="range" min="-5" max="20" step="0.1" value="${item.altitude || 0}" 
                           oninput="aplicarAjuste3D(${item.id}, 'altitude', this.value, false)" 
                           onchange="aplicarAjuste3D(${item.id}, 'altitude', this.value, true)"
                           class="w-full accent-green-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                  </div>
                </div>
              </div>
            `;
          });
        };

        // --- NOVAS FUNÇÕES UNIFICADAS DE MANIPULAÇÃO 3D ---
        window.toggleMenu3D = function(id) {
          // Se o menu clicado já estava aberto, ele fecha. Se não, ele abre o novo.
          idMenu3DAberto = (idMenu3DAberto === id) ? null : id;
          window.atualizarInterfaceEMapa();
        };

        // --- NOVO MOTOR DE AJUSTE CONTÍNUO (SLIDERS) ---
        window.aplicarAjuste3D = function(id, propriedade, valor, salvarNaNuvem) {
          const item = window.bancoDeDadosItens.find(i => i.id === id);
          if (item) {
            const numVal = parseFloat(valor);
            item[propriedade] = numVal;
            
            // Atualiza os textos da interface em tempo real
            const label = document.getElementById(`val-${propriedade}-${id}`);
            if(label) {
                 if(propriedade === 'escala') label.innerText = numVal.toFixed(2) + 'x';
                 else if(propriedade === 'altitude') label.innerText = numVal.toFixed(1) + 'm';
                 else label.innerText = numVal + '°';
            }

            if (salvarNaNuvem) {
              // Quando o usuário soltar o mouse, envia para a Prefeitura
              window.sincronizarAtualizacaoNuvem(item);
              window.atualizarInterfaceEMapa(); 
            } else {
              // MÁGICA: Enquanto arrasta, atualiza SÓ O GRÁFICO específico na memória de vídeo, sem travar o site
              const grafico = graphicsLayer.graphics.find(g => g.attributes && g.attributes.idVisual === id);
              if (grafico) {
                 grafico.symbol = criarSimboloGLB(item.arquivo_glb, item.escala, item.rotacao, item.inclinacao || 0);
                 
                 // Se mexer na altura, precisa recalcular a coordenada 3D
                 if (propriedade === 'altitude') {
                     const novaGeometria = grafico.geometry.clone();
                     novaGeometria.z = numVal;
                     grafico.geometry = novaGeometria;
                 }
              }
            }
          }
        };

        // --- AÇÕES DE EDIÇÃO (CRUD) ---
        window.deletarItem = function(id) {
          const item = window.bancoDeDadosItens.find(i => i.id === id);
          if (item) window.sincronizarDelecaoNuvem(item.objectId); // <--- MANDA DELETAR NA NUVEM
          
          window.bancoDeDadosItens = window.bancoDeDadosItens.filter(i => i.id !== id);
          atualizarInterfaceEMapa();
        };

        window.mudarStatus = function(id) {
          const item = window.bancoDeDadosItens.find(i => i.id === id);
          if (item) {
            item.status = item.status === "OK" ? "Necessita Conserto" : "OK";
            window.sincronizarAtualizacaoNuvem(item); // <--- MANDA PRA NUVEM
            atualizarInterfaceEMapa();
          }
        };

        window.editarNomeItem = function(id) {
          const item = window.bancoDeDadosItens.find(i => i.id === id);
          if (item) {
            const novoNome = prompt("Digite o novo nome para o mobiliário:", item.nome);
            if (novoNome && novoNome.trim() !== "") {
              item.nome = novoNome;
              window.sincronizarAtualizacaoNuvem(item); // <--- MANDA PRA NUVEM
              atualizarInterfaceEMapa();
            }
          }
        };

        // --- CATÁLOGO DOS SEUS ARQUIVOS GLB E IMAGENS ---
        const catalogoModelos = [
          { id: 'banco1', nome: 'Banco Low Poly', arquivo: 'bench_low_poly.glb', imagem: 'banco1.png' },
          { id: 'banco2', nome: 'Banco de Parque', arquivo: 'low_poly_-_park_bench.glb', imagem: 'banco2.png' },
          { id: 'arvore1', nome: 'Árvore Folhas', arquivo: 'leaf_tree_-_ps1_low_poly.glb', imagem: 'arvore1.png' },
          { id: 'arvore2', nome: 'Palmeira', arquivo: 'palm_tree.glb', imagem: 'arvore2.png' },
          { id: 'arvore3', nome: 'Pinheiro Estilizado', arquivo: 'pine_tree__low_poly_stylized_tree.glb', imagem: 'arvore3.png' },
          { id: 'arvore4', nome: 'Pinheiro PS1', arquivo: 'pine_tree_-_ps1_low_poly.glb', imagem: 'arvore4.png' },
          { id: 'poste1', nome: 'Poste Simples A', arquivo: 'simple_lamp_post_model_a.glb', imagem: 'poste1.png' },
          { id: 'poste2', nome: 'Poste de Rua', arquivo: 'street_lamp.glb', imagem: 'poste2.png' },
          { id: 'poste3', nome: 'Poste Estilizado', arquivo: 'streetlight_-_low_poly__stylized.glb', imagem: 'poste3.png' },
          { id: 'lixeira1', nome: 'Lixeira de Rua', arquivo: 'street_trash_can__low_poly__free.glb', imagem: 'lixeira1.png' },
          { id: 'bebedouro1', nome: 'Bebedouro', arquivo: 'lowpoly_drinking_fountain.glb', imagem: 'bebedouro.png' },
          { id: 'vestiario1', nome: 'Banheiro', arquivo: 'low_poly_toilet_stall.glb', imagem: 'banheiro.png' },
          { id: 'monumento1', nome: 'Estátua', arquivo: 'statue._monument_in_alba_italy.glb', imagem: 'monumento.png' },
          { id: 'monumento2', nome: 'Monumento', arquivo: 'monumento_memorial.glb', imagem: 'monumento2.png' },
          { id: 'chess', nome: 'Mesa de jogo', arquivo: 'chess_board_on_table.glb', imagem: 'chess.png' },
          { id: 'chess2', nome: 'Mesa de jogo 2', arquivo: 'chess_table.glb', imagem: 'chess2.png' },
          { id: 'quadra1', nome: 'Quadra Esportiva', arquivo: 'sport_court.glb', imagem: 'quadra.png' },
          { id: 'campo1', nome: 'Campo de Futebol', arquivo: 'futbol_sahasi.glb', imagem: 'campo.png' },
          { id: 'basquete', nome: 'Quadra de Basquete', arquivo: 'basketball_court.glb', imagem: 'basquete.png' },
          { id: 'tennis', nome: 'Quadra de Tênis - Saibro', arquivo: 'quadra_tenis_saibro.glb', imagem: 'tenis-saibro.png' },
          { id: 'tennis2', nome: 'Quadra de Tênis - Rápida', arquivo: 'quadra_tenis_rapida.glb', imagem: 'tenis-rapida.png' },
          { id: 'cancha1', nome: 'Cancha de Bocha', arquivo: 'campo_de_bocha.glb', imagem: 'cancha.png' },
          { id: 'skate1', nome: 'Pista de Skate', arquivo: 'halfpipe_skatepark_ramp_-_low_poly_baked.glb', imagem: 'skate.png' },
          { id: 'play1', nome: 'Playground Infantil', arquivo: 'playground.glb', imagem: 'playground.png' },
          { id: 'play2', nome: 'Gangorra', arquivo: 'seesaw.glb', imagem: 'playground2.png' },
          { id: 'play3', nome: 'Escorregador', arquivo: 'slide_game-asset_under_2.5k_triangles_and_uvs.glb', imagem: 'playground3.png' },
          { id: 'academia', nome: 'Academia ao Ar Livre', arquivo: 'simple_low_poly_calisthenics.glb', imagem: 'academia_ar_livre.jpg' },
          { id: 'academia1', nome: 'Academia', arquivo: 'academia_ar_livre.glb', imagem: 'academia_ar_livre.jpg' },
          { id: 'ginastica1', nome: 'Aparelhos de Ginástica', arquivo: 'gym_equipment_2.glb', imagem: 'ginastica.png' },
          { id: 'churrasqueira1', nome: 'Churrasqueira', arquivo: 'barbecue.glb', imagem: 'churrasqueira.png' },
          { id: 'estar1', nome: 'Área de Estar/Pergolado', arquivo: 'pergola_low_poly.glb', imagem: 'pergolado.png' }
        ];

        let modeloEscolhidoUrl = null;

        // --- FUNÇÕES DO MODAL ---
        window.abrirCatalogoModelos = function() {
          const inputNome = document.getElementById('input-nome-item');
          if (inputNome.value.trim() === '') {
            alert("⚠️ Digite um nome para o item primeiro (ex: Poste Central).");
            inputNome.focus();
            return;
          }

          const grid = document.getElementById('grid-modelos');
          grid.innerHTML = '';

          // Gera os "cards" para você escolher (Agora com 3D REAL AO VIVO)
          catalogoModelos.forEach(modelo => {
            // Garante que o sistema ache o arquivo na pasta certa
            const caminhoGLB = modelo.arquivo.includes('/') ? modelo.arquivo : "modelos/" + modelo.arquivo;
            
            grid.innerHTML += `
              <button onclick="selecionarModelo('${modelo.arquivo}')" class="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-gray-200 hover:border-green-500 hover:shadow-md transition group relative">
                
                <div class="w-20 h-20 mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden relative">
                  <model-viewer 
                    src="./${caminhoGLB}" 
                    auto-rotate 
                    camera-controls 
                    interaction-prompt="none"
                    shadow-intensity="1"
                    style="width: 100%; height: 100%; background-color: transparent;">
                  </model-viewer>
                  
                  <div class="absolute inset-0 z-10 cursor-pointer"></div>
                </div>
                
                <span class="text-xs font-bold text-gray-700 text-center leading-tight">${modelo.nome}</span>
                <span class="text-[9px] text-gray-400 mt-1 truncate w-full text-center" title="${modelo.arquivo}">${modelo.arquivo}</span>
              </button>
            `;
          });

          document.getElementById('modal-catalogo').classList.remove('hidden');
        };

        window.fecharCatalogoModelos = function() {
          document.getElementById('modal-catalogo').classList.add('hidden');
        };

        window.selecionarModelo = function(arquivoGLB) {
          modeloEscolhidoUrl = arquivoGLB;
          fecharCatalogoModelos();
          
          modoInteracaoMapa = 'adicionar';
          document.getElementById('mapa-container').style.cursor = 'crosshair';
          document.getElementById('msg-instrucao').innerText = `📍 Clique no mapa para plantar o modelo: ${arquivoGLB}`;
          document.getElementById('msg-instrucao').classList.remove('hidden');
        };

        // --- ATUALIZAÇÃO DA FUNÇÃO QUE DESENHA O ITEM ---
        function criarSimboloGLB(arquivo, escala = 1, rotacao = 0, inclinacao = 0) {
          const caminhoArquivo = arquivo.includes('/') ? arquivo : "modelos/" + arquivo;
          return {
            type: "point-3d",
            symbolLayers: [{
              type: "object",
              resource: { href: "./" + caminhoArquivo },
              height: 3 * escala, 
              heading: rotacao,     // Giro (Z)
              tilt: inclinacao      // Inclinação (X/Y)
            }]
          };
        }

        window.ativarModoMover = function(id) {
          modoInteracaoMapa = 'mover';
          idItemSendoMovido = id;
          document.getElementById('mapa-container').style.cursor = 'crosshair';
          document.getElementById('msg-instrucao').innerText = "📍 Clique no novo local do mapa para MOVER.";
          document.getElementById('msg-instrucao').classList.remove('hidden');
        };

        function cancelarAcaoMapa() {
          modoInteracaoMapa = null;
          idItemSendoMovido = null;
          document.getElementById('mapa-container').style.cursor = 'default';
          document.getElementById('msg-instrucao').classList.add('hidden');
        }

        // Variável para guardar o estado do contorno azul
        let highlightHover = null;

        // --- NOVO: HOVER COM TOOLTIP CUSTOMIZADO E CONTORNO AZUL ---
        view.on("pointer-move", function(event) {
          const tooltip = document.getElementById('custom-tooltip');

          if (modoInteracaoMapa !== null) {
            tooltip.classList.add('hidden');
            // Remove o contorno se entrar em modo de edição
            if (highlightHover) { highlightHover.remove(); highlightHover = null; }
            return;
          }

          view.hitTest(event, { include: graphicsLayer }).then(function(response) {
            if (response.results.length > 0) {
              const graphicHovered = response.results[0].graphic;
              
              if (graphicHovered && graphicHovered.attributes && graphicHovered.attributes.nome) {
                
                // --- A MÁGICA DO CONTORNO AZUL ---
                view.whenLayerView(graphicsLayer).then(function(layerView) {
                  // Apaga o contorno do item anterior (se houver)
                  if (highlightHover) { highlightHover.remove(); }
                  // Acende o contorno azul no item atual
                  highlightHover = layerView.highlight(graphicHovered);
                });
                
                // 1. Preenche os textos
                document.getElementById('tooltip-title').innerText = graphicHovered.attributes.nome;
                const statusLocal = graphicHovered.attributes.status || "OK";
                const corStatus = statusLocal === 'OK' ? 'text-green-600' : 'text-red-600';
                document.getElementById('tooltip-status').innerHTML = `Status: <b class="${corStatus}">${statusLocal}</b>`;
                
                // 2. A MÁGICA 3D: Pega a geometria do objeto e cria um ponto temporário no "TOPO" dele
                let pontoTopo = graphicHovered.geometry.clone();
                
                if (graphicHovered.attributes.tipo === "modelo") {
                  pontoTopo.z = (pontoTopo.z || 0) + (3 * graphicHovered.attributes.escala);
                } else if (graphicHovered.attributes.tipo === "alerta") {
                  pontoTopo.z = (pontoTopo.z || 0) + 0.2;
                }
                
                // 3. Converte a coordenada 3D exata do TOPO para a tela
                const telaCoord = view.toScreen(pontoTopo);
                
                // 4. Posiciona o balão com o respiro de 25px
                tooltip.style.left = telaCoord.x + "px";
                tooltip.style.top = (telaCoord.y - 25) + "px"; 
                tooltip.style.transform = "translate(-50%, -100%)"; 
                
                tooltip.classList.remove('hidden');
                tooltip.classList.add('flex');
                document.getElementById('mapa-container').style.cursor = 'pointer';
              }
            } else {
              // --- REMOVE O CONTORNO AO TIRAR O RATO DO OBJETO ---
              if (highlightHover) {
                highlightHover.remove();
                highlightHover = null;
              }

              // Esconde o balão
              tooltip.classList.add('hidden');
              tooltip.classList.remove('flex');
              document.getElementById('mapa-container').style.cursor = 'default';
            }
          });
        });

        // Ouve o clique real no mapa
        view.on("click", function(event) {
          if (modoInteracaoMapa === 'adicionar') {
            event.stopPropagation();
            const nomeDigitado = document.getElementById('input-nome-item').value;
            const geometriaClone = event.mapPoint.clone(); // Pega a geometria perfeita da Esri

            const novoItem = {
              id: Date.now(), 
              praca: pracaAtivaId,
              nome: nomeDigitado,
              arquivo_glb: modeloEscolhidoUrl, 
              status: "OK",
              lon: geometriaClone.longitude || geometriaClone.x,
              lat: geometriaClone.latitude || geometriaClone.y,
              escala: 1, 
              rotacao: 0, 
              altitude: 0,
              geometriaOriginal: geometriaClone
            };
            
            window.bancoDeDadosItens.push(novoItem);
            window.sincronizarAdicaoNuvem(novoItem, geometriaClone); 
            
            document.getElementById('input-nome-item').value = '';
            cancelarAcaoMapa();
            atualizarInterfaceEMapa();
          } 
          else if (modoInteracaoMapa === 'mover') {
            event.stopPropagation();
            const item = window.bancoDeDadosItens.find(i => i.id === idItemSendoMovido);
            if (item) {
              const geometriaNova = event.mapPoint.clone();
              item.lon = geometriaNova.longitude || geometriaNova.x;
              item.lat = geometriaNova.latitude || geometriaNova.y;
              item.geometriaOriginal = geometriaNova;
              
              window.sincronizarAtualizacaoNuvem(item, geometriaNova); // Manda atualizar com a nova posição
            }
            cancelarAcaoMapa();
            atualizarInterfaceEMapa();
          }
          else {
            // DETECTA CLIQUE NO POLÍGONO DA PRAÇA 
            view.hitTest(event).then(function(response) {
              const pracaClicadaHit = response.results.find(
                (resultado) => resultado.graphic.layer && resultado.graphic.layer.id === "pracas-parques"
              );

              if (pracaClicadaHit) {
                const pracaGraphic = pracaClicadaHit.graphic;
                const atributos = pracaGraphic.attributes;
                
                // USA A MESMA FUNÇÃO UNIFICADORA DO PAINEL LATERAL
                const infoPraca = extrairIdENomePraca(atributos);
                
                // Configura as coordenadas de voo padrão para manter o foco perfeito
                let lonVoo = event.mapPoint.longitude;
                let latVoo = event.mapPoint.latitude;
                
                if (infoPraca.id === "Matriz") { lonVoo = -51.2305; latVoo = -30.0338; }
                else if (infoPraca.id === "Alfandega") { lonVoo = -51.2295; latVoo = -30.0298; }
                else if (infoPraca.id === "Redencao") { lonVoo = -51.2185; latVoo = -30.0355; }
                else if (infoPraca.id === "Carlesso") { lonVoo = -51.194719; latVoo = -29.984137; }

                // Abre a gestão usando exatamente a mesma ID e Nome
                window.abrirGestaoPraca(infoPraca.id, infoPraca.nome, lonVoo, latVoo);
                
                if (document.getElementById('content-inventario').classList.contains('hidden')) {
                  document.getElementById('btn-inventario').click();
                }
              }
            });
          }
        });
      });
      switchTab(document.getElementById('btn-intro'), document.getElementById('content-intro'));
    });

// --- MOTOR DE AUTO-GERAÇÃO DE MOBILIÁRIO EM LOTE ---
        window.autoGerarMobiliario = function(idPraca) {
          const pracaGeo = window.todasAsPracas.find(p => p.idOficial === idPraca);
          if (!pracaGeo) return;

          const extrairNumero = (texto) => {
              if (!texto) return 0;
              const num = String(texto).replace(/\D/g, ''); 
              return num ? parseInt(num) : 0;
          };

          const qtdBancos = extrairNumero(pracaGeo.bancos);
          const qtdLixeiras = extrairNumero(pracaGeo.lixeiras);
          const qtdPostes = pracaGeo.iluminacao ? 4 : 0; 

          const totalItens = qtdBancos + qtdLixeiras + qtdPostes;

          if (totalItens === 0 && !pracaGeo.ambientes) {
              alert("⚠️ A base da prefeitura não especifica quantidades nem ambientes para esta praça.");
              return;
          }

          const confirmacao = confirm(`Deseja espalhar os itens menores (bancos/lixeiras) e analisar as estruturas grandes?`);
          if (!confirmacao) return;

          let itensGerados = 0;

          // Matemática para não deixar os itens caírem na rua (Ray Casting)
          const pontoDentroDoPoligono = (lon, lat, polygon) => {
              let inside = false;
              if (!polygon || !polygon.rings) return true; 
              for (let r = 0; r < polygon.rings.length; r++) {
                  let ring = polygon.rings[r];
                  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                      let xi = ring[i][0], yi = ring[i][1];
                      let xj = ring[j][0], yj = ring[j][1];
                      let intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
                      if (intersect) inside = !inside;
                  }
              }
              return inside;
          };

          const choverItensNoMapa = (nome, arquivo_glb, quantidade) => {
              for (let i = 0; i < quantidade; i++) {
                  let lonAleatoria = pracaGeo.lon;
                  let latAleatoria = pracaGeo.lat;
                  
                  if (pracaGeo.extent && pracaGeo.geometriaPoligono) {
                      let achouLocal = false;
                      let tentativas = 0;
                      
                      while (!achouLocal && tentativas < 100) {
                          lonAleatoria = pracaGeo.extent.xmin + Math.random() * (pracaGeo.extent.xmax - pracaGeo.extent.xmin);
                          latAleatoria = pracaGeo.extent.ymin + Math.random() * (pracaGeo.extent.ymax - pracaGeo.extent.ymin);
                          
                          if (pontoDentroDoPoligono(lonAleatoria, latAleatoria, pracaGeo.geometriaPoligono)) {
                              achouLocal = true; 
                          }
                          tentativas++;
                      }
                  }

                  const geometriaPoint = { 
                      type: "point", 
                      longitude: lonAleatoria, 
                      latitude: latAleatoria,
                      spatialReference: { wkid: 4326 }
                  };

                  const novoItem = {
                      id: Date.now() + Math.floor(Math.random() * 100000), 
                      praca: idPraca,
                      nome: `${nome} Automático ${i+1}`,
                      arquivo_glb: arquivo_glb, 
                      status: "OK",
                      lon: geometriaPoint.longitude,
                      lat: geometriaPoint.latitude,
                      escala: 1, 
                      rotacao: Math.floor(Math.random() * 360), 
                      altitude: 0,
                      geometriaOriginal: geometriaPoint
                  };

                  window.bancoDeDadosItens.push(novoItem);
                  window.sincronizarAdicaoNuvem(novoItem, geometriaPoint);
                  itensGerados++;
              }
          };

          if (qtdBancos > 0) choverItensNoMapa("Banco", "low_poly_-_park_bench.glb", qtdBancos);
          if (qtdLixeiras > 0) choverItensNoMapa("Lixeira", "street_trash_can__low_poly__free.glb", qtdLixeiras);
          if (qtdPostes > 0) choverItensNoMapa("Poste", "street_lamp.glb", qtdPostes);

          // --- RADAR COMPLETO DA PREFEITURA: Busca os 10 ambientes ---
          let avisoAmbientesManuais = "";
          if (pracaGeo.ambientes) {
              const ambText = pracaGeo.ambientes.toLowerCase();
              let detectados = [];
              
              if (ambText.includes("quadra") || ambText.includes("esporte")) detectados.push("⚽ Quadra Esportiva");
              if (ambText.includes("campo")) detectados.push("🏟️ Campo de Futebol");
              if (ambText.includes("cancha") || ambText.includes("bocha")) detectados.push("🎳 Cancha de Bocha");
              if (ambText.includes("skate") || ambText.includes("radical")) detectados.push("🛹 Pista de Skate");
              if (ambText.includes("infantil") || ambText.includes("brinquedo") || ambText.includes("play")) detectados.push("🛝 Playground");
              if (ambText.includes("academia")) detectados.push("🦾 Academia ao Ar Livre");
              if (ambText.includes("ginástica") || ambText.includes("ginastica") || ambText.includes("aparelho")) detectados.push("🏋️ Equip. de Ginástica");
              if (ambText.includes("jogo") || ambText.includes("xadrez") || ambText.includes("dama")) detectados.push("♟️ Mesas de Jogo");
              if (ambText.includes("churrasqueira") || ambText.includes("fogo")) detectados.push("🥩 Churrasqueira");
              if (ambText.includes("estar") || ambText.includes("convivência")) detectados.push("☕ Área de Estar/Pergolado");

              detectados = [...new Set(detectados)]; // Limpa redundâncias

              if (detectados.length > 0) {
                  avisoAmbientesManuais = `\n\n📌 ATENÇÃO - ESTRUTURAS GRANDES:\nO sistema detectou: ${detectados.join(", ")}.\n\nPor favor, adicione estes itens manualmente através do botão 'Novo Mobiliário' para garantir o alinhamento com a imagem de satélite.`;
              }
          }

          alert(`🪄 Mágica concluída! ${itensGerados} itens espalhados pela grama respeitando os limites.${avisoAmbientesManuais}`);
          window.atualizarInterfaceEMapa();
        };

// --- LÓGICA DE NAVEGAÇÃO DA BARRA VERTICAL E GAVETA ---
const btnIntro = document.getElementById('btn-intro');
const btnMapa = document.getElementById('btn-mapa');
const btnObras = document.getElementById('btn-obras');
const btnInventario = document.getElementById('btn-inventario');

const contentIntro = document.getElementById('content-intro');
const contentMapa = document.getElementById('content-mapa');
const contentObras = document.getElementById('content-obras');
const contentInventario = document.getElementById('content-inventario');

const painelConteudo = document.getElementById('painel-conteudo');
const textoPainelAtivo = document.getElementById('texto-painel-ativo');
const iconePainelAtivo = document.getElementById('icone-painel-ativo');

const buttons = [btnIntro, btnMapa, btnObras, btnInventario];
const contents = [contentIntro, contentMapa, contentObras, contentInventario];

// Dicionário de títulos para o cabeçalho da Gaveta
const infoPaineis = {
  'btn-intro': { texto: 'Início', icone: '' },
  'btn-mapa': { texto: 'Estilos de Mapa', icone: '' },
  'btn-obras': { texto: 'Gestão de Obras', icone: '' },
  'btn-inventario': { texto: 'Inventário 3D', icone: '' }
};

const wrapperGaveta = document.getElementById('wrapper-gaveta');
const barraLateral = document.getElementById('barra-lateral');

// Reseta o visual dos ícones
function resetTabs() {
  buttons.forEach(btn => {
    btn.classList.remove('text-green-700', 'bg-green-50', 'border-green-200', 'shadow-sm');
    btn.classList.add('text-gray-400', 'border-transparent');
  });
  contents.forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('block');
  });
}

// Abre a Gaveta e EXPANDIR a Barra para o tamanho da tela
window.switchTab = function(clickedBtn, contentToShow) {
  const isGavetaAberta = !wrapperGaveta.classList.contains('opacity-0');
  const isBotaoAtivo = clickedBtn.classList.contains('text-green-700');

  // Interruptor: Fechar ao clicar no mesmo ícone
  if (isGavetaAberta && isBotaoAtivo) {
    window.minimizarPainel();
    return;
  }

  resetTabs();
  
  // Acende o botão clicado
  clickedBtn.classList.remove('text-gray-400', 'border-transparent');
  clickedBtn.classList.add('text-green-700', 'bg-green-50', 'border-green-200', 'shadow-sm');
  
  textoPainelAtivo.innerText = infoPaineis[clickedBtn.id].texto;
  iconePainelAtivo.innerText = infoPaineis[clickedBtn.id].icone;

  contentToShow.classList.remove('hidden');
  contentToShow.classList.add('block');
  
  // 1. MÁGICA: Revela e desliza a gaveta para a esquerda
  wrapperGaveta.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
  
  // 2. METAMORFOSE: Arranca o visual de pílula central e transforma em uma parede direita conectada
  barraLateral.classList.remove('top-1/2', '-translate-y-1/2', 'rounded-full', 'bg-white/90', 'border', 'py-3');
  barraLateral.classList.add('top-24', 'bottom-6', 'translate-y-0', 'rounded-r-2xl', 'bg-white/95', 'border-y', 'border-r', 'border-l-0', 'py-6');
}

// Minimiza a Gaveta e ENCOLHE a Barra de volta à Pílula
window.minimizarPainel = function() {
  // 1. Esconde a gaveta deslizando
  wrapperGaveta.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');
  
  // 2. METAMORFOSE: Arranca o visual de parede conectada e volta a ser pílula solta no meio da tela
  barraLateral.classList.remove('top-24', 'bottom-6', 'translate-y-0', 'rounded-r-2xl', 'bg-white/95', 'border-y', 'border-r', 'border-l-0', 'py-6');
  barraLateral.classList.add('top-1/2', '-translate-y-1/2', 'rounded-full', 'bg-white/90', 'border', 'py-3');
  
  resetTabs();
};

// Eventos de clique nos ícones
btnIntro.addEventListener('click', () => switchTab(btnIntro, contentIntro));
btnMapa.addEventListener('click', () => switchTab(btnMapa, contentMapa));
btnObras.addEventListener('click', () => switchTab(btnObras, contentObras));
btnInventario.addEventListener('click', () => switchTab(btnInventario, contentInventario));
// Abre a introdução por padrão ao carregar a página

