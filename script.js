    // LÓGICA DO ARCGIS (Mapa 3D)
    require([
      "esri/Map",
      "esri/views/SceneView",
      "esri/Graphic",
      "esri/layers/GraphicsLayer",
      "esri/widgets/BasemapGallery",
      "esri/layers/GeoJSONLayer",
      "esri/layers/FeatureLayer",
      "esri/layers/TileLayer"
    ], function(Map, SceneView, Graphic, GraphicsLayer, BasemapGallery, GeoJSONLayer, FeatureLayer, TileLayer) {

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

      // --- NOVO: Camada de Satélite Global da Esri ---
      const camadaSatelite = new TileLayer({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        opacity: 0.5 // Inicia em 50% (Mescla exata com o mapa base)
      });

      const map = new Map({
        basemap: "osm", // MÁGICA: Trocamos para o mapa vetorial plano (sem prédios 3D)
        ground: "world-elevation", // Mantém o relevo do terreno (morros) em 3D
        layers: [camadaSatelite, graphicsLayer, pracasLayer] 
      });

      // --- CONEXÃO DO SLIDER HTML COM A OPACIDADE DO SATÉLITE ---
      const sliderMescla = document.getElementById('slider-mescla-mapa');
      if (sliderMescla) {
        sliderMescla.addEventListener('input', function(event) {
          // O slider vai de 0 a 100. A opacidade do ArcGIS vai de 0.0 a 1.0.
          // Dividimos por 100 para converter!
          camadaSatelite.opacity = event.target.value / 100;
        });
      }

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

        window.graficoDashboard = null; // Guarda o gráfico para podermos destruí-lo e recriá-lo

        window.renderizarDashboard = function() {
            // 1. Define os escopos (Global vs Local)
            let pracasAlvo = window.todasAsPracas || [];
            let itensAlvo = window.bancoDeDadosItens || [];
            let obrasAlvo = window.bancoDeDadosObras || [];
            let titulo = "Visão Global";
            let badge = "Todo o Município";

            // Se tem uma praça selecionada, filtra os dados SÓ para ela!
            if (pracaAtivaId) {
                const praca = pracasAlvo.find(p => p.idOficial === pracaAtivaId);
                titulo = praca ? praca.nome : "Detalhes da Praça";
                badge = "Dados Locais";
                
                pracasAlvo = praca ? [praca] : [];
                itensAlvo = itensAlvo.filter(i => i.praca === pracaAtivaId);
                obrasAlvo = obrasAlvo.filter(o => o.praca === pracaAtivaId);
            }

            // 2. Escreve os textos na tela
            document.getElementById('dash-titulo').innerText = titulo;
            document.getElementById('dash-badge').innerText = badge;
            document.getElementById('dash-qtd-pracas').innerText = pracasAlvo.length;
            document.getElementById('dash-qtd-itens').innerText = itensAlvo.length;

            // 3. Calcula Orçamento Somado
            const totalOrcamento = obrasAlvo.reduce((soma, obra) => {
                const valor = parseFloat(obra.orcamento) || 0;
                return soma + valor;
            }, 0);
            
            document.getElementById('dash-orcamento').innerText = totalOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // 4. Calcula Status dos Itens para o Gráfico
            const qtdOK = itensAlvo.filter(i => i.status === "OK").length;
            const qtdConserto = itensAlvo.filter(i => i.status === "Necessita Conserto").length;

            // 5. Renderiza o Gráfico Pizza com Chart.js
            const ctx = document.getElementById('grafico-manutencao');
            
            // Destrói o gráfico antigo se existir, para não sobrepor
            if (window.graficoDashboard) {
                window.graficoDashboard.destroy();
            }

            if (itensAlvo.length === 0) {
                ctx.style.display = 'none'; // Esconde se não tiver dados
                return;
            } else {
                ctx.style.display = 'block';
            }

            window.graficoDashboard = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Em Boas Condições', 'Necessita Conserto'],
                    datasets: [{
                        data: [qtdOK, qtdConserto],
                        backgroundColor: ['#22c55e', '#ef4444'], // Verde e Vermelho Tailwind
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 10 } } }
                    }
                }
            });
        };
        
      // --- CONEXÃO COM O BANCO DE DADOS NA NUVEM (ARCGIS ONLINE) ---
        const urlMinhaCamada = "https://gis-smamus.portoalegre.rs.gov.br/server/rest/services/Hosted/Mobili%C3%A1rio_urbano_das_pra%C3%A7as/FeatureServer/0"; 
        
        window.camadaItensNuvem = new FeatureLayer({
           url: urlMinhaCamada,
           outFields: ["*"]
        });

        window.bancoDeDadosItens = []; // Começa vazio

        // --- DICIONÁRIO INTELIGENTE DE GAVETAS ---
        window.obterNomeGaveta = function(arquivo_glb) {
            const arq = (arquivo_glb || "").toLowerCase();
            
            if (arq.includes('bench_low_poly') || arq.includes('park_bench')) return "Bancos";
            
            // MÁGICA: A Iluminação precisa vir ANTES das Árvores para o 'streetlight' não ser confundido com 'tree'!
            if (arq.includes('lamp_post') || arq.includes('street_lamp') || arq.includes('streetlight')) return "Iluminação (Postes)";
            if (arq.includes('tree') || arq.includes('palm_tree') || arq.includes('pine_tree')) return "Árvores e Vegetação";
            
            if (arq.includes('trash_can') || arq.includes('drinking_fountain')) return "Lixeiras e Bebedouros";
            if (arq.includes('toilet_stall') || arq.includes('vestiario')) return "Banheiros e Vestiários";
            if (arq.includes('statue') || arq.includes('monument')) return "Monumentos Históricos";
            if (arq.includes('chess')) return "Mesas de Jogo (Dama/Xadrez)";
            if (arq.includes('court') || arq.includes('sahasi') || arq.includes('bocha') || arq.includes('tenis') || arq.includes('volei') || arq.includes('beach_tennis')) return "Quadras Esportivas e Canchas";
            if (arq.includes('skate') || arq.includes('halfpipe')) return "Pistas de Skate";
            if (arq.includes('playground') || arq.includes('seesaw') || arq.includes('slide')) return "Playground Infantil";
            if (arq.includes('calisthenics') || arq.includes('gym') || arq.includes('academia')) return "Academia ao Ar Livre";
            if (arq.includes('barbecue') || arq.includes('churrasqueira')) return "Churrasqueiras";
            if (arq.includes('pergola') || arq.includes('estar')) return "Áreas de Estar e Pergolados";
            
            return "Outros Equipamentos";
        };

        // --- FOCO BIDIRECIONAL (Card -> Mapa) ---
        window.focarObjetoNoMapa = function(id) {
          // Procura o objeto dentro dos gráficos desenhados no mapa 3D
          const graphic = graphicsLayer.graphics.find(g => g.attributes && g.attributes.idVisual === id && g.attributes.tipo === "modelo");
          
          if (graphic) {
            // Voa a câmera para pertinho do objeto, focando de cima
            view.goTo({ target: graphic, zoom: 21.5, tilt: 60 }, { duration: 1500 });

            // Dá uma piscada no card para o usuário não se perder
            const card = document.getElementById(`card-item-${id}`);
            if (card) {
                card.classList.add('border-purple-500', 'ring-2', 'ring-purple-300', 'bg-purple-50');
                setTimeout(() => card.classList.remove('border-purple-500', 'ring-2', 'ring-purple-300', 'bg-purple-50'), 2000);
            }
          }
        };

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
              rolagem: novoItem.rolagem,
              altitude: novoItem.altitude,
              inclinacao: novoItem.inclinacao || 0,
              // CORREÇÃO: Enviamos 'null' em vez de texto vazio para não estourar o banco do ArcGIS
              obra_titulo: novoItem.titulo || null,
              obra_imagem: novoItem.imagem || null,
              obra_empreiteira: novoItem.empreiteira || null,
              obra_orcamento: novoItem.orcamento ? parseFloat(novoItem.orcamento) : null,
              obra_inicio: novoItem.dataInicio || null,
              obra_fim: novoItem.dataFim || null,
              obra_status: novoItem.statusObra || null,
              obra_progresso: novoItem.porcentagem || null,
              obra_desc: novoItem.descricao || null
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
  
  // Monta os atributos que serão enviados para a nuvem
  const atributosEdicao = {
      praca_id: item.praca,
      nome: item.nome,
      arquivo_glb: item.arquivo_glb,
      status: item.status,
      escala: item.escala,
      rotacao: item.rotacao,
      altitude: item.altitude,
      inclinacao: item.inclinacao || 0,
      
      // 🌟 AQUI ESTÁ A MÁGICA: Enviando a imagem e os campos de obra para a nuvem!
      obra_imagem: item.obra_imagem || "",
      obra_titulo: item.obra_titulo || "",
      obra_empreiteira: item.obra_empreiteira || "",
      obra_orcamento: item.obra_orcamento || 0,
      obra_inicio: item.obra_inicio ? new Date(item.obra_inicio).getTime() : null, // Converte data de volta para milissegundos
      obra_fim: item.obra_fim ? new Date(item.obra_fim).getTime() : null,         // Converte data de volta para milissegundos
      obra_status: item.obra_status || "Planejado",
      obra_progresso: item.obra_progresso || 0,
      obra_desc: item.obra_desc || "",
      rolagem: item.rolagem || 0
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
         console.log("🔵 Atualizado na nuvem com sucesso!");
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
              let idReal = null;
              for (const key in f.attributes) {
                  if (key.toLowerCase() === 'objectid' || key.toLowerCase() === 'fid') { idReal = f.attributes[key]; break; }
              }
              idReal = idReal || f.attributes.OBJECTID || Math.floor(Math.random() * 1000000);
              
              return {
                 objectId: idReal,
                 id: idReal,
                 praca: f.attributes.praca_id,
                 nome: f.attributes.nome,
                 arquivo_glb: f.attributes.arquivo_glb,
                 status: f.attributes.status,
                 escala: f.attributes.escala || 1,
                 rotacao: f.attributes.rotacao || 0,
                 altitude: f.attributes.altitude || 0,
                 inclinacao: f.attributes.inclinacao || 0, 
                 rolagem: f.attributes.rolagem || 0,
                 lon: f.geometry.longitude || f.geometry.x, 
                 lat: f.geometry.latitude || f.geometry.y,
                 geometriaOriginal: f.geometry,
                 
                 // --- LENDO OS CAMPOS DE OBRA DO SEU BANCO DE DADOS ---
                 obra_titulo: f.attributes.obra_titulo,
                 obra_imagem: f.attributes.obra_imagem,
                 obra_empreiteira: f.attributes.obra_empreiteira,
                 obra_orcamento: f.attributes.obra_orcamento,
                 obra_inicio: f.attributes.obra_inicio, 
                 obra_fim: f.attributes.obra_fim,
                 obra_status: f.attributes.obra_status,
                 obra_progresso: f.attributes.obra_progresso,
                 obra_desc: f.attributes.obra_desc
              };
           });

           // --- MÁGICA: CRIA A LISTA DE OBRAS PUXANDO DIRETO DA NUVEM ---
           // Filtra apenas os itens que tem título de obra preenchido
           window.bancoDeDadosObras = window.bancoDeDadosItens
             .filter(i => i.obra_titulo && i.obra_titulo.trim() !== "")
             .map(i => {
                // O ArcGIS devolve datas em milissegundos (Epoch). Convertendo para "YYYY-MM-DD" pro HTML
                const formataData = (epoch) => {
                   if(!epoch) return "";
                   const d = new Date(epoch);
                   return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                };
                
                return {
                   id: i.id, 
                   praca: i.praca,
                   local: window.todasAsPracas.find(p => p.idOficial === i.praca)?.nome || "Praça Desconhecida",
                   titulo: i.obra_titulo,
                   imagem: i.obra_imagem,
                   empreiteira: i.obra_empreiteira,
                   orcamento: i.obra_orcamento || "0", 
                   dataInicio: formataData(i.obra_inicio),
                   dataFim: formataData(i.obra_fim),
                   status: i.obra_status || "Planejado",
                   porcentagem: i.obra_progresso || 0,
                   descricao: i.obra_desc || "",
                   lon: i.lon,
                   lat: i.lat
                };
             });

           console.log(`✅ Sucesso: ${window.bancoDeDadosItens.length} itens (e ${window.bancoDeDadosObras.length} obras) carregados da nuvem!`);
           
           window.renderizarPainelObras(); // Renderiza o painel lateral de obras com dados da nuvem
           if (pracaAtivaId) window.atualizarInterfaceEMapa();

        }).catch(erro => console.error("🔴 Erro ao ler da nuvem:", erro));
      
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

        // --- NOVA FUNÇÃO: VOA PARA A PRAÇA SEM ABRIR A EDIÇÃO ---
        window.voarParaPraca = function(lon, lat) {
          event.stopPropagation(); // Impede que o clique abra a tela de gestão sem querer
          view.goTo({ 
            target: [lon, lat], 
            zoom: 19.5, 
            tilt: 45 
          }, { 
            duration: 2000 
          });
        };

        // --- NOVA FUNÇÃO: ABRIR/FECHAR BUSCA MOBILE ---
        window.toggleBuscaMobile = function() {
            const popup = document.getElementById('popup-busca-mobile');
            popup.classList.toggle('hidden');
            if(!popup.classList.contains('hidden')) {
                document.getElementById('input-pesquisa-mobile').focus();
            }
        };

        // --- INTEGRAÇÃO DO INPUT MOBILE ---
        const inputMobile = document.getElementById('input-pesquisa-mobile');
        if (inputMobile) {
          inputMobile.addEventListener('input', (e) => {
            const termo = e.target.value;
            window.renderizarListaPracas(termo);
            
            // Mantém os outros inputs sincronizados
            const inputLocal = document.getElementById('input-pesquisa-local');
            if (inputLocal) inputLocal.value = termo;
            const inputGlob = document.getElementById('input-pesquisa-global');
            if (inputGlob) inputGlob.value = termo;
            
            // Aciona o painel de inventário automaticamente
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
          
          // LIGA TODAS AS PRAÇAS NOVAMENTE (Remove o filtro)
          view.whenLayerView(pracasLayer).then(function(layerView) {
            layerView.filter = null;
          });

          document.getElementById('tela-lista-pracas').classList.remove('hidden');
          document.getElementById('tela-gestao-praca').classList.add('hidden');
          
          const divObras = document.getElementById('lista-obras-dinamica');
          if (divObras) {
              divObras.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Selecione uma praça no Inventário para filtrar as obras.</p>';
          }
          if (typeof window.renderizarDashboard === 'function') window.renderizarDashboard();
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

        // --- NOVO MOTOR DO PAINEL DE OBRAS (COM INTEGRAÇÃO 3D) ---
        window.filtroObrasAtivo = 'Todos';

        window.filtrarObras = function(status) {
          window.filtroObrasAtivo = status;
          
          // Estiliza as pílulas de filtro
          const classesInativas = "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-white text-gray-500 border border-transparent hover:bg-gray-50";
          ['Todos', 'Em Execução', 'Planejado', 'Concluído'].forEach(s => {
             const btn = document.getElementById(`btn-filtro-obra-${s.replace(' ', '')}`);
             if (btn) {
               if (s === status) {
                 btn.className = "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-gray-800 text-white shadow-sm border border-gray-800";
               } else {
                 btn.className = classesInativas;
               }
             }
          });
          window.renderizarPainelObras();
        };

        window.renderizarPainelObras = function() {
          const divObras = document.getElementById('lista-todas-obras');
          divObras.innerHTML = '';

          // Filtra itens da nuvem que possuem título de obra (indica que é um item em obra)
          let obrasFiltradas = window.bancoDeDadosItens.filter(i => i.obra_titulo && i.obra_titulo.trim() !== "");

          // Aplica o Filtro Global de Status (se selecionado)
          if (window.filtroObrasAtivo !== 'Todos') {
            obrasFiltradas = obrasFiltradas.filter(o => o.obra_status === window.filtroObrasAtivo);
          }

          // NOVO: Aplica o Filtro da Barra de Pesquisa de Obras
          const inputPesquisa = document.getElementById('input-pesquisa-obras');
          if (inputPesquisa && inputPesquisa.value.trim() !== "") {
              const termo = inputPesquisa.value.toLowerCase();
              obrasFiltradas = obrasFiltradas.filter(o => 
                  (o.obra_titulo && o.obra_titulo.toLowerCase().includes(termo)) ||
                  (o.obra_empreiteira && o.obra_empreiteira.toLowerCase().includes(termo)) ||
                  (o.nome && o.nome.toLowerCase().includes(termo))
              );
          }

          if (obrasFiltradas.length === 0) {
            divObras.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma obra encontrada com estes filtros.</p>';
            return;
          }

          obrasFiltradas.forEach(obra => {
            // Usamos o campo obra_status para a cor e o progresso
            const cor = obterCorStatusObra(obra.obra_status);
            
            divObras.innerHTML += `
              <div onclick="abrirDetalheObra(${obra.id})" class="bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition overflow-hidden group">
                <div class="h-24 w-full relative overflow-hidden bg-gray-200">
                   <img src="${obra.obra_imagem}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="Foto da Obra">
                   <div class="absolute top-2 right-2 px-2 py-1 text-[9px] font-black rounded-lg uppercase ${cor} shadow-sm border-0 backdrop-blur-md bg-opacity-90">${obra.obra_status}</div>
                </div>
                <div class="p-4">
                  <h3 class="text-sm font-bold text-gray-800 mb-1 leading-tight">${obra.obra_titulo}</h3>
                  <div class="text-[10px] text-gray-500 mb-3 flex items-center gap-2">
                    <span>📍 Praça vinculada ao item: ${obra.nome}</span>
                  </div>
                  
                  <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200 mb-1">
                    <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${obra.obra_progresso}%"></div>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-bold text-gray-500">
                    <span>${obra.obra_progresso}% Concluído</span>
                    <span class="text-blue-600">Ver detalhes →</span>
                  </div>
                </div>
              </div>
            `;
          });
        };

       window.abrirDetalheObra = function(id) {
    const obra = window.bancoDeDadosItens.find(i => i.id === id);
    if(!obra) return;

    // A MÁGICA DA CORREÇÃO: Esconde a lista e o FORMULÁRIO, mostra apenas o detalhe
    document.getElementById('tela-lista-obras').classList.add('hidden');
    document.getElementById('tela-formulario-obra').classList.add('hidden'); // <--- ESTA LINHA FALTAVA!
    document.getElementById('tela-detalhe-obra').classList.remove('hidden');

    const cor = obterCorStatusObra(obra.obra_status);
    const pracaNome = window.todasAsPracas.find(p => p.idOficial === obra.praca)?.nome || "Praça Desconhecida";
    const formataData = (epoch) => {
       if(!epoch) return "";
       const d = new Date(epoch);
       return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0].split('-').reverse().join('/');
    };

    document.getElementById('conteudo-detalhe-obra').innerHTML = `
      <img src="${obra.obra_imagem}" class="w-full h-40 object-cover rounded-xl shadow-sm border border-gray-200 mb-4">
      <div>
        <span class="px-2 py-1 text-[10px] font-black rounded-lg uppercase ${cor} mb-2 inline-block border">${obra.obra_status}</span>
        <h2 class="text-xl font-bold text-gray-800 leading-tight mb-1">${obra.obra_titulo}</h2>
        <p class="text-xs font-semibold text-gray-500 mb-4 flex items-center gap-1">📍 ${pracaNome}</p>
      </div>
      <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
        <h3 class="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-3">Resumo Contratual</h3>
        <div class="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
          <div><span class="block text-[9px] text-gray-500 font-bold uppercase">Orçamento</span><span class="font-bold text-gray-800">R$ ${obra.obra_orcamento || 0}</span></div>
          <div><span class="block text-[9px] text-gray-500 font-bold uppercase">Empreiteira</span><span class="font-bold text-gray-800 truncate" title="${obra.obra_empreiteira}">${obra.obra_empreiteira}</span></div>
          <div><span class="block text-[9px] text-gray-500 font-bold uppercase">Início</span><span class="font-medium text-gray-700">${formataData(obra.obra_inicio)}</span></div>
          <div><span class="block text-[9px] text-gray-500 font-bold uppercase">Prazo / Fim</span><span class="font-medium text-gray-700">${formataData(obra.obra_fim)}</span></div>
        </div>
      </div>
      <div>
        <h3 class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Escopo do Projeto</h3>
        <p class="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">${obra.obra_desc}</p>
      </div>
      <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
         <div class="flex justify-between items-center mb-2">
           <span class="text-xs font-bold text-gray-800">Progresso Físico</span>
           <span class="text-sm font-black text-blue-600">${obra.obra_progresso}%</span>
         </div>
         <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
           <div class="bg-blue-500 h-full rounded-full transition-all duration-1000" style="width: ${obra.obra_progresso}%"></div>
         </div>
      </div>
    `;
    
    document.getElementById('btn-editar-obra-ativa').onclick = function() { window.abrirFormularioObra(id); };
    document.getElementById('btn-deletar-obra-ativa').onclick = function() { window.deletarObra(id); };

    const pracaGeo = window.todasAsPracas.find(p => p.idOficial === obra.praca);
    if (pracaGeo && pracaGeo.geometriaPoligono) {
      view.whenLayerView(pracasLayer).then(function(layerView) {
        layerView.filter = { geometry: pracaGeo.geometriaPoligono, spatialRelationship: "intersects" };
        view.goTo({ target: pracaGeo.geometriaPoligono, tilt: 55, zoom: 18.5 }, { duration: 2500 });
      });
    }

    // 🔴 A MÁGICA: Desenha a obra no mapa instantaneamente, SE ela não estiver concluída!
    graphicsLayer.removeAll();
    if (obra.obra_status !== "Concluído") {
        const geoItem = { type: "point", longitude: obra.lon, latitude: obra.lat, z: obra.altitude || 0, spatialReference: { wkid: 4326 } };
        
        // Desenha o Modelo GLB
        graphicsLayer.add(new Graphic({
            geometry: geoItem,
            attributes: { idVisual: obra.id, nome: obra.obra_titulo, tipo: "modelo" },
            symbol: criarSimboloGLB(obra.arquivo_glb || 'obra_em_andamento.glb', 1, 0, 0, "OK")
        }));

        // Desenha o Pino (Azul ou Laranja)
        let corPino = [245, 158, 11]; // Laranja (Em Execução)
        if (obra.obra_status === "Planejado") corPino = [59, 130, 246]; // Azul
        
        graphicsLayer.add(new Graphic({
            geometry: geoItem,
            attributes: { idVisual: obra.id, tipo: "indicador" },
            symbol: {
                type: "point-3d",
                verticalOffset: { screenLength: 60, maxWorldLength: 100, minWorldLength: 1 },
                callout: { type: "line", size: 1.5, color: corPino, border: { color: [255, 255, 255] } },
                symbolLayers: [{ type: "icon", resource: { primitive: "circle" }, material: { color: corPino }, outline: { color: "white", size: 0.4 }, size: 14 }]
            }
        }));
    }
};
          
          

        window.voltarParaListaObras = function() {
    document.getElementById('tela-lista-obras').classList.remove('hidden');
    document.getElementById('tela-detalhe-obra').classList.add('hidden');
    document.getElementById('tela-formulario-obra').classList.add('hidden');
    
    // Limpa o mapa 3D para voltar à visão limpa da cidade
    graphicsLayer.removeAll(); 

    // Remove o isolamento e volta a mostrar a cidade toda
    view.whenLayerView(pracasLayer).then(function(layerView) {
      layerView.filter = null;
    });
};
        // --- FUNÇÕES DE EDIÇÃO E CRIAÇÃO DE OBRAS ---
        window.preencherSelectPracas = function() {
          const select = document.getElementById('form-obra-praca');
          select.innerHTML = '<option value="">Selecione uma Praça...</option>';
          // Usa a variável global de praças para preencher o formulário
          window.todasAsPracas.forEach(p => {
            select.innerHTML += `<option value="${p.idOficial}" data-nome="${p.nome}" data-lon="${p.lon}" data-lat="${p.lat}">${p.nome}</option>`;
          });
        };

        window.tempArquivoObraPC = null; // Guarda a foto da obra fisicamente

// Mostra o preview se o usuário escolher um arquivo do PC
window.previewObraImagem = function(event) {
    const file = event.target.files[0];
    if(file) {
        window.tempArquivoObraPC = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('preview-obra-imagem');
            img.src = e.target.result;
            img.classList.remove('hidden');
            document.getElementById('form-obra-imagem').value = ""; // Limpa a URL se escolheu PC
        }
        reader.readAsDataURL(file);
    }
};

// Mostra o preview se o usuário colar uma URL da internet
window.previewObraUrl = function(url) {
    window.tempArquivoObraPC = null; // Anula o arquivo do PC
    const img = document.getElementById('preview-obra-imagem');
    if(url && url.trim() !== "") {
        img.src = url;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
        img.src = "";
    }
};

        window.abrirFormularioObra = function(idObra = null) {
  document.getElementById('tela-lista-obras').classList.add('hidden');
  document.getElementById('tela-detalhe-obra').classList.add('hidden');
  document.getElementById('tela-formulario-obra').classList.remove('hidden');
  
  window.preencherSelectPracas();
  window.tempArquivoObraPC = null; // Zera a imagem do PC ao abrir
  document.getElementById('form-obra-imagem-file').value = ""; // Reseta o input file

  if (idObra) {
    // MODO EDIÇÃO
    document.getElementById('titulo-formulario-obra').innerText = "Editar Obra";
    const obra = window.bancoDeDadosItens.find(o => o.id === idObra);
    
    const formataDataInput = (epoch) => {
       if(!epoch) return "";
       const d = new Date(epoch);
       return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    };

    document.getElementById('form-obra-id').value = obra.id;
    document.getElementById('form-obra-praca').value = obra.praca;
    document.getElementById('form-obra-titulo').value = obra.obra_titulo;
    document.getElementById('form-obra-imagem').value = obra.obra_imagem || "";
    document.getElementById('form-obra-empreiteira').value = obra.obra_empreiteira;
    document.getElementById('form-obra-orcamento').value = obra.obra_orcamento;
    document.getElementById('form-obra-inicio').value = formataDataInput(obra.obra_inicio);
    document.getElementById('form-obra-fim').value = formataDataInput(obra.obra_fim);
    document.getElementById('form-obra-status').value = obra.obra_status;
    document.getElementById('form-obra-progresso').value = obra.obra_progresso;
    document.getElementById('form-obra-desc').value = obra.obra_desc;
    
    window.previewObraUrl(obra.obra_imagem); // Atualiza o preview com a foto antiga
  } else {
    // MODO CRIAÇÃO 
    document.getElementById('titulo-formulario-obra').innerText = "Nova Obra";
    document.getElementById('form-obra-id').value = "";
    document.getElementById('form-obra-praca').value = "";
    document.getElementById('form-obra-titulo').value = "";
    document.getElementById('form-obra-imagem').value = "";
    document.getElementById('form-obra-empreiteira').value = "";
    document.getElementById('form-obra-orcamento').value = "";
    document.getElementById('form-obra-inicio').value = "";
    document.getElementById('form-obra-fim').value = "";
    document.getElementById('form-obra-status').value = "Planejado";
    document.getElementById('form-obra-progresso').value = "0";
    document.getElementById('form-obra-desc').value = "";
    
    window.previewObraUrl(""); // Limpa o preview
  }
};

window.salvarObraNoBanco = function() {
  const idCampo = document.getElementById('form-obra-id').value;
  const selectPraca = document.getElementById('form-obra-praca');
  const optionSelecionada = selectPraca.options[selectPraca.selectedIndex];
  
  if (!optionSelecionada.value) { alert("Selecione uma praça!"); return; }

  const btnSalvar = document.querySelector('#tela-formulario-obra button[onclick="salvarObraNoBanco()"]');
  btnSalvar.innerText = "A guardar obra... (Aguarde)";
  btnSalvar.disabled = true;

  let orcamentoLimpo = parseFloat(document.getElementById('form-obra-orcamento').value.toString().replace(/\./g, '').replace(',', '.')) || 0;
  const dataInicioStr = document.getElementById('form-obra-inicio').value;
  const dataFimStr = document.getElementById('form-obra-fim').value;
  
  const atributosEdicao = {
      praca_id: optionSelecionada.value,
      nome: optionSelecionada.getAttribute('data-nome'), 
      arquivo_glb: "obra_em_andamento.glb", 
      status: "OK", 
      obra_titulo: document.getElementById('form-obra-titulo').value,
      obra_empreiteira: document.getElementById('form-obra-empreiteira').value,
      obra_orcamento: orcamentoLimpo,
      obra_inicio: dataInicioStr ? new Date(dataInicioStr).getTime() : null,
      obra_fim: dataFimStr ? new Date(dataFimStr).getTime() : null,
      obra_status: document.getElementById('form-obra-status').value,
      obra_progresso: parseInt(document.getElementById('form-obra-progresso').value) || 0,
      obra_desc: document.getElementById('form-obra-desc').value
  };

  // 1. A MÁGICA DA VELOCIDADE: Atualiza os dados em segundo plano
  const finalizarESair = (idSalvo) => {
      btnSalvar.innerText = "Salvar Obra";
      btnSalvar.disabled = false;
      window.renderizarPainelObras();
      
      // NOVA LINHA: Se a praça estiver aberta no fundo, manda o cardzinho se atualizar na hora!
      if (pracaAtivaId) {
          window.atualizarInterfaceEMapa();
      }

      if (idSalvo) {
          window.abrirDetalheObra(idSalvo);
      } else {
          window.voltarParaListaObras();
      }
  };

  const subirAnexoSeExistir = (objectIdFinal) => {
      return new Promise((resolve, reject) => {
          if (!window.tempArquivoObraPC) {
              resolve(document.getElementById('form-obra-imagem').value); 
              return;
          }
          btnSalvar.innerText = "A enviar fotografia...";
          const formData = new FormData();
          formData.append("attachment", window.tempArquivoObraPC);
          
          const nomeColuna = window.camadaItensNuvem.objectIdField || "OBJECTID";
          const graphicAnexo = { attributes: {} };
          graphicAnexo.attributes[nomeColuna] = objectIdFinal;

          window.camadaItensNuvem.addAttachment(graphicAnexo, formData).then((res) => {
              if(res.error) return reject(res.error);
              btnSalvar.innerText = "A gerar link oficial...";
              window.camadaItensNuvem.queryAttachments({ objectIds: [objectIdFinal] }).then((anexos) => {
                  const lista = anexos[objectIdFinal];
                  if(lista && lista.length > 0) resolve(lista[lista.length - 1].url);
                  else reject("URL não retornada pelo servidor");
              }).catch(reject);
          }).catch(reject);
      });
  };

  if (idCampo) {
    const idInt = parseInt(idCampo);
    atributosEdicao[window.camadaItensNuvem.objectIdField || "OBJECTID"] = idInt;

    subirAnexoSeExistir(idInt).then((urlFinal) => {
        atributosEdicao.obra_imagem = urlFinal; 
        const index = window.bancoDeDadosItens.findIndex(i => i.id === idInt);
        if(index !== -1) window.bancoDeDadosItens[index] = { ...window.bancoDeDadosItens[index], ...atributosEdicao };

        window.camadaItensNuvem.applyEdits({ updateFeatures: [{ attributes: atributosEdicao }] })
            .then(() => finalizarESair(idInt)).catch(err => { console.error(err); finalizarESair(idInt); });
            
    }).catch(err => { alert("Erro ao enviar anexo."); finalizarESair(idInt); });

  } else {
    const graphicNovo = new Graphic({
        geometry: { type: "point", longitude: parseFloat(optionSelecionada.getAttribute('data-lon')), latitude: parseFloat(optionSelecionada.getAttribute('data-lat')), spatialReference: { wkid: 4326 } },
        attributes: atributosEdicao
    });

    window.camadaItensNuvem.applyEdits({ addFeatures: [graphicNovo] }).then((res) => {
        if (res.addFeatureResults.length > 0 && res.addFeatureResults[0].objectId) {
            const idOficial = res.addFeatureResults[0].objectId;
            
            subirAnexoSeExistir(idOficial).then((urlFinal) => {
                if (window.tempArquivoObraPC) {
                    const attUpdate = { ...atributosEdicao, obra_imagem: urlFinal };
                    attUpdate[window.camadaItensNuvem.objectIdField || "OBJECTID"] = idOficial;
                    window.camadaItensNuvem.applyEdits({ updateFeatures: [{ attributes: attUpdate }] });
                }
                const itemNovo = { ...atributosEdicao, obra_imagem: urlFinal, id: idOficial, objectId: idOficial };
                window.bancoDeDadosItens.push(itemNovo);
                
                // Manda abrir a obra no mapa na mesma hora!
                finalizarESair(idOficial);
            });
        }
    }).catch(err => { console.error(err); finalizarESair(null); });
  }
};
                    
        // Renderiza a lista na inicialização
        window.renderizarPainelObras();

        // Deletar obra do painel
        window.deletarObra = function(id) {
          if(!confirm("⚠️ Tem certeza que deseja excluir esta obra permanentemente do sistema?")) return;
          
          // Remove do banco de dados unificado na hora!
          window.bancoDeDadosItens = window.bancoDeDadosItens.filter(i => i.id !== id);
          
          // Atualiza a Interface
          window.voltarParaListaObras();
          window.renderizarPainelObras();
          if (pracaAtivaId) window.atualizarInterfaceEMapa();

          // Manda a ordem de deleção pra Nuvem 
          window.sincronizarDelecaoNuvem(id);
        };


        // --- ATUALIZAR MAPA E LISTA LATERAL DO INVENTÁRIO (CORRIGIDO E UNIFICADO) ---
        window.atualizarInterfaceEMapa = function() {
          graphicsLayer.removeAll();
          const divLista = document.getElementById('lista-itens-dinamica');
          divLista.innerHTML = '';

          // RECUPERADO: Linha vital que filtra os itens...
          let itensDaPraca = window.bancoDeDadosItens.filter(i => i.praca === pracaAtivaId);

          // NOVO: Aplica o filtro de status no mapa 3D (Os itens ocultos sequer serão desenhados)
          if (window.filtroStatusAtivo !== 'Todos') {
              itensDaPraca = itensDaPraca.filter(i => i.status === window.filtroStatusAtivo);
          }
          // NOVO: Aplica o filtro de visibilidade de Categoria no Mapa 3D
          itensDaPraca = itensDaPraca.filter(i => {
              const categoria = window.obterCategoriaItem(i.arquivo_glb);
              return window.visibilidadeCategorias[categoria];
          });
          // Puxa os dados oficiais de inventário do arquivo GEOJSON
          const pracaGeo = window.todasAsPracas.find(p => p.idOficial === pracaAtivaId);

         // --- FILTRO NATIVO: ESCONDE AS OUTRAS PRAÇAS ---
          if (pracaGeo && pracaGeo.geometriaPoligono) {
            view.whenLayerView(pracasLayer).then(function(layerView) {
              // Mantém APENAS a praça que foi clicada visível
              layerView.filter = {
                geometry: pracaGeo.geometriaPoligono,
                spatialRelationship: "intersects"
              };
            });
          }

          // Lógica de Renderização de Obras e Inventário Oficial
          const divStatusObra = document.getElementById('status-obra-praca');
          let painelSuperiorHTML = '';

          // 1. Verifica se tem OBRA acontecendo lendo direto do banco principal AO VIVO
          const obraDaPraca = window.bancoDeDadosItens.find(o => o.praca === pracaAtivaId && o.obra_titulo && o.obra_titulo.trim() !== "");
          
          if (obraDaPraca) {
            const cor = obterCorStatusObra(obraDaPraca.obra_status);
            painelSuperiorHTML += `
              <div class="p-3 rounded-xl border text-xs shadow-sm mb-3 ${cor}">
                <div class="flex justify-between items-center mb-1">
                  <strong> ${obraDaPraca.obra_status}</strong>
                  <span class="font-bold">${obraDaPraca.obra_progresso || 0}%</span>
                </div>
                <div class="font-semibold text-[13px] mb-1">${obraDaPraca.obra_titulo}</div>
                <div class="text-[11px] opacity-80 line-clamp-1">${obraDaPraca.obra_desc || ''}</div>
              </div>
            `;
          }

          // 2. Puxa os dados oficiais de inventário do arquivo GEOJSON
        
          if (pracaGeo) {
            const temDado = (valor) => valor && valor.toString().trim() !== "" && valor.toString().trim() !== "0" && valor.toString().trim() !== "Não informado";
            
            if (temDado(pracaGeo.bancos) || temDado(pracaGeo.lixeiras) || temDado(pracaGeo.iluminacao) || temDado(pracaGeo.ambientes)) {
              painelSuperiorHTML += `
                <div class="bg-blue-50/50 p-3 rounded-xl border border-blue-200 shadow-sm mb-4">
                  <div class="flex justify-between items-start mb-2">
                    <h4 class="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1"> Inventário Oficial</h4>
                    <button onclick="autoGerarMobiliario('${pracaGeo.idOficial}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow transition flex items-center gap-1">
                      Auto-Gerar 3D
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-[10px] text-gray-700">
                    ${temDado(pracaGeo.bancos) ? `<div><strong class="text-gray-900">Bancos:</strong> ${pracaGeo.bancos}</div>` : ''}
                    ${temDado(pracaGeo.lixeiras) ? `<div><strong class="text-gray-900">Lixeiras:</strong> ${pracaGeo.lixeiras}</div>` : ''}
                    ${temDado(pracaGeo.iluminacao) ? `<div><strong class="text-gray-900">Iluminação:</strong> ${pracaGeo.iluminacao}</div>` : ''}
                    ${temDado(pracaGeo.bebedouros) ? `<div><strong class="text-gray-900">Bebedouros:</strong> ${pracaGeo.bebedouros}</div>` : ''}
                    ${temDado(pracaGeo.vestiarios) ? `<div><strong class="text-gray-900">Vestiários:</strong> ${pracaGeo.vestiarios}</div>` : ''}
                    ${temDado(pracaGeo.pistaPatinacao) ? `<div><strong class="text-gray-900">Pista Patinação:</strong> ${pracaGeo.pistaPatinacao}</div>` : ''}
                    ${temDado(pracaGeo.irrigacao) ? `<div><strong class="text-gray-900">Irrigação:</strong> Sim</div>` : ''}
                    ${temDado(pracaGeo.cercamento) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">Cercamento:</strong> ${pracaGeo.cercamento}</div>` : ''}
                    ${temDado(pracaGeo.monumentos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">Monumentos:</strong> ${pracaGeo.monumentos}</div>` : ''}
                    ${temDado(pracaGeo.equipDiversos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">Outros Equip.:</strong> ${pracaGeo.equipDiversos}</div>` : ''}
                    ${temDado(pracaGeo.elementos) ? `<div class="col-span-2 mt-1"><strong class="text-gray-900">Elementos:</strong> ${pracaGeo.elementos}</div>` : ''}
                    ${temDado(pracaGeo.ambientes) ? `<div class="col-span-2 mt-1 pt-1 border-t border-blue-100"><strong class="text-gray-900">Ambientes:</strong> ${pracaGeo.ambientes}</div>` : ''}
                  </div>
                </div>
              `;
            }
          }

          divStatusObra.innerHTML = painelSuperiorHTML;

          // LOOP: Desenha os GLBs e cria os Cards
          itensDaPraca.forEach(item => {
            
            // 🔴 NOVA MÁGICA: Se a obra estiver concluída, sai daqui e não desenha NADA!
            if (item.arquivo_glb && item.arquivo_glb.includes("obra_em_andamento") && item.obra_status === "Concluído") {
                return; 
            }

            // 1. Desenha o seu Modelo GLB Oficial
            let geoItem;
            if (item.geometriaOriginal && typeof item.geometriaOriginal.clone === 'function') {
              geoItem = item.geometriaOriginal.clone();
            } else {
              geoItem = { type: "point", longitude: item.lon, latitude: item.lat, spatialReference: { wkid: 4326 } };
            }
            geoItem.z = item.altitude || 0;

            const modeloGrafico = new Graphic({
              geometry: geoItem, 
              attributes: { idVisual: item.id, nome: item.nome, status: item.status, escala: item.escala || 1, tipo: "modelo" },
              symbol: criarSimboloGLB(item.arquivo_glb || 'obra_em_andamento.glb', item.escala || 1, item.rotacao || 0, item.inclinacao || 0, item.rolagem || 0, item.status)
            });
            graphicsLayer.add(modeloGrafico);

            // 2. O PINO VERMELHO DE CONSERTO (Mobiliário Quebrado)
            if (item.status === "Necessita Conserto") {
              const geoIndicador = geoItem.clone();
              const indicadorGrafico = new Graphic({
                geometry: geoIndicador,
                attributes: { idVisual: item.id, tipo: "indicador" },
                symbol: {
                  type: "point-3d",
                  verticalOffset: { screenLength: 50, maxWorldLength: 100, minWorldLength: 1 },
                  callout: { type: "line", size: 1.5, color: [239, 68, 68], border: { color: [255, 255, 255] } },
                  symbolLayers: [{ type: "icon", resource: { primitive: "circle" }, material: { color: [239, 68, 68] }, outline: { color: "white", size: 0.4 }, size: 12 }]
                }
              });
              graphicsLayer.add(indicadorGrafico);
            }

            // 3. A MÁGICA PARA OBRAS: PINO AZUL OU LARANJA
            if (item.arquivo_glb && item.arquivo_glb.includes("obra_em_andamento")) {
              let corPino = [245, 158, 11]; // Laranja (Em Execução) padrão
              if (item.obra_status === "Planejado") corPino = [59, 130, 246]; // Azul
              
              const geoIndicadorObra = geoItem.clone();

              const indicadorObraGrafico = new Graphic({
                geometry: geoIndicadorObra,
                attributes: { idVisual: item.id, tipo: "indicador" },
                symbol: {
                  type: "point-3d",
                  verticalOffset: { screenLength: 60, maxWorldLength: 100, minWorldLength: 1 },
                  callout: { type: "line", size: 1.5, color: corPino, border: { color: [255, 255, 255] } },
                  symbolLayers: [{ type: "icon", resource: { primitive: "circle" }, material: { color: corPino }, outline: { color: "white", size: 0.4 }, size: 14 }]
                }
              });
              graphicsLayer.add(indicadorObraGrafico);
            }
          });
          // DELEGAR: Agora chamamos a nova função que cuida APENAS do menu de HTML com as sanfonas
          const termoPesquisaSalvo = document.getElementById('input-pesquisa-itens') ? document.getElementById('input-pesquisa-itens').value : "";
          window.renderizarHTMLInventario(termoPesquisaSalvo);
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
              // Atualiza o Modelo 3D no mapa
              const grafico = graphicsLayer.graphics.find(g => g.attributes && g.attributes.idVisual === id && g.attributes.tipo === "modelo");
              if (grafico) {
                 grafico.symbol = criarSimboloGLB(item.arquivo_glb, item.escala, item.rotacao, item.inclinacao || 0, item.rolagem || 0, item.status);
                 if (propriedade === 'altitude') {
                     const novaGeometria = grafico.geometry.clone();
                     novaGeometria.z = numVal;
                     grafico.geometry = novaGeometria;
                 }
              }

              // Atualiza a Seta (Callout) ao vivo
              const indicador = graphicsLayer.graphics.find(g => g.attributes && g.attributes.idVisual === id && g.attributes.tipo === "indicador");
              if (indicador) {
                 // A única coisa que importa agora é a altitude do chão. O tamanho e a flutuação são automáticos!
                 if (propriedade === 'altitude') {
                     const novaGeoIndicador = indicador.geometry.clone();
                     novaGeoIndicador.z = numVal; // Apenas iguala a altitude do objeto
                     indicador.geometry = novaGeoIndicador;
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

        // --- SISTEMA DE GESTÃO DE IMAGENS DO MOBILIÁRIO (URL + LOCAL PC) ---

// Variável global temporária para guardar o arquivo lido do PC em Base64
window.tempImagemBase64 = null;

// 1. Função para abrir o Modal de Upload/Configuração de Imagem
window.abrirModalImagem = function(id) {
  // Busca à prova de falhas: testa todas as variações de letras do ArcGIS
  const item = window.bancoDeDadosItens.find(i => 
      String(i.id) === String(id) || 
      String(i.objectid) === String(id) || 
      String(i.OBJECTID) === String(id) ||
      String(i.idVisual) === String(id)
  );
  
  if (!item) {
     alert("Erro: O item não foi encontrado. ID buscado: " + id);
     return;
  }

  const modalExistente = document.getElementById('modal-imagem-mobiliario');
  if (modalExistente) modalExistente.remove();

  // Usa EXATAMENTE o campo do seu banco de dados
  const imagemAtual = item.obra_imagem || "";

  const modalHTML = `
    <div id="modal-imagem-mobiliario" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background-color: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-green-100 flex flex-col gap-4 mx-4 relative">
        
        <div class="flex justify-between items-center border-b pb-3">
          <h3 class="text-base font-bold text-gray-800">Imagem de: <span class="text-green-700">${item.nome || "Objeto"}</span></h3>
          <button onclick="document.getElementById('modal-imagem-mobiliario').remove()" class="text-gray-400 hover:text-red-500 text-2xl font-bold transition">&times;</button>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Visualização:</span>
          <div class="w-full h-44 bg-gray-100 rounded-xl overflow-hidden border border-dashed border-gray-300 flex items-center justify-center relative">
            <img id="preview-foto-modal" src="${imagemAtual}" style="${!imagemAtual ? 'display: none;' : ''} width: 100%; height: 100%; object-fit: cover;" />
            <span id="placeholder-foto-modal" class="text-sm text-gray-400" style="${imagemAtual ? 'display: none;' : ''}">Sem imagem cadastrada</span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-bold text-gray-600 uppercase tracking-wider">Opção 1: Arquivo do PC</span>
          <label class="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl border border-green-200 cursor-pointer transition text-sm font-semibold shadow-sm">
            Escolher Arquivo
            <input type="file" accept="image/*" style="display: none;" onchange="window.processarUploadImagemLocal(event)" />
          </label>
        </div>

        <div class="relative flex py-1 items-center">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink mx-4 text-gray-400 text-[10px] uppercase tracking-widest font-bold">OU</span>
            <div class="flex-grow border-t border-gray-200"></div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-bold text-gray-600 uppercase tracking-wider">Opção 2: Link (URL)</span>
          <input type="text" id="input-url-imagem" value="${imagemAtual && !imagemAtual.startsWith('data:') ? imagemAtual : ''}" placeholder="https://site.com/foto.jpg" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition" oninput="window.processarUrlImagemLocal(this.value)" />
        </div>

        <div class="flex gap-3 mt-3 border-t pt-4">
          <button onclick="document.getElementById('modal-imagem-mobiliario').remove()" class="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-semibold">Cancelar</button>
          <button onclick="window.salvarNovaImagemMobiliario('${id}')" class="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl transition text-sm font-semibold shadow-md">Salvar Imagem</button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  window.tempImagemBase64 = null;
};

  

// 2. Processa o arquivo selecionado no PC
window.tempImagemBase64 = null;
window.tempArquivoImagemPC = null; // NOVA: Guarda o ficheiro real!

window.processarUploadImagemLocal = function(event) {
  const file = event.target.files[0];
  if (file) {
    window.tempArquivoImagemPC = file; // Guarda o ficheiro físico na memória

    const reader = new FileReader();
    reader.onload = function(e) {
      window.tempImagemBase64 = e.target.result; 
      
      const preview = document.getElementById('preview-foto-modal');
      const placeholder = document.getElementById('placeholder-foto-modal');
      
      preview.src = e.target.result;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      
      document.getElementById('input-url-imagem').value = ""; // Limpa a URL
    };
    reader.readAsDataURL(file);
  }
};

// 3. Atualiza o preview se o usuário colar uma URL direta
window.processarUrlImagemLocal = function(url) {
  window.tempArquivoImagemPC = null; // ANULA o ficheiro se o utilizador digitar um texto
  window.tempImagemBase64 = null; 
  
  const preview = document.getElementById('preview-foto-modal');
  const placeholder = document.getElementById('placeholder-foto-modal');
  
  if (url && url.trim() !== "") {
    preview.src = url;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    preview.style.display = 'none';
    placeholder.style.display = 'block';
  }
};

// 4. Salva a decisão final no objeto, sincroniza com a prefeitura/nuvem e recarrega a tela
window.salvarNovaImagemMobiliario = function(id) {
  const item = window.bancoDeDadosItens.find(i => 
      String(i.id) === String(id) || 
      String(i.objectid) === String(id) || 
      String(i.OBJECTID) === String(id) ||
      String(i.idVisual) === String(id)
  );

  if (!item) return;

  const botoes = document.querySelectorAll('#modal-imagem-mobiliario button');
  if (botoes.length > 1) botoes[1].innerText = "A guardar anexo..."; 

  if (window.tempArquivoImagemPC) {
      console.log("A enviar ficheiro físico para o ArcGIS...");

      const formData = new FormData();
      formData.append("attachment", window.tempArquivoImagemPC);

      const nomeColunaId = window.camadaItensNuvem.objectIdField || "OBJECTID";
      const graphicParaAnexo = { attributes: {} };
      graphicParaAnexo.attributes[nomeColunaId] = item.objectId;

      window.camadaItensNuvem.addAttachment(graphicParaAnexo, formData).then(function(resultado) {
          
          // 1. Verifica se o ArcGIS rejeitou a foto silenciosamente
          if (resultado.error) {
              console.error("🔴 O ArcGIS rejeitou o arquivo:", resultado.error);
              alert("Erro ao enviar: " + resultado.error.description);
              if (botoes.length > 1) botoes[1].innerText = "Tentar Novamente";
              return;
          }

          console.log("✅ Anexo enviado! Pedindo o link oficial ao servidor...");
          if (botoes.length > 1) botoes[1].innerText = "A gerar link...";

          // 2. A MÁGICA: Pede ao ArcGIS a URL oficial do anexo que acabamos de subir
          window.camadaItensNuvem.queryAttachments({
              objectIds: [item.objectId]
          }).then(function(anexosResult) {
              const listaAnexos = anexosResult[item.objectId];
              
              if (listaAnexos && listaAnexos.length > 0) {
                  // Pega o anexo mais recente
                  const anexoRecente = listaAnexos[listaAnexos.length - 1];
                  console.log("🔗 URL Oficial recebida:", anexoRecente.url);
                  
                  // Salva a URL perfeita devolvida pelo ArcGIS
                  item.obra_imagem = anexoRecente.url;
                  fecharEAtualizar(item);
              } else {
                  alert("Anexo salvo, mas o servidor não devolveu a URL.");
              }
          }).catch(function(errQuery) {
              console.error("Erro ao buscar URL:", errQuery);
              // Plano B: Monta a URL na mão se a busca falhar
              let urlBase = window.camadaItensNuvem.url;
              if (window.camadaItensNuvem.layerId !== undefined && !urlBase.endsWith("/" + window.camadaItensNuvem.layerId)) {
                  urlBase += "/" + window.camadaItensNuvem.layerId;
              }
              item.obra_imagem = `${urlBase}/${item.objectId}/attachments/${resultado.attachmentId}`;
              fecharEAtualizar(item);
          });

      }).catch(function(erro) {
          console.error("🔴 Erro crítico de rede:", erro);
          alert("Ocorreu um erro de conexão ao tentar enviar a foto.");
          if (botoes.length > 1) botoes[1].innerText = "Tentar Novamente";
      });

  } else {
      // Se for apenas uma URL colada da internet
      const urlVal = document.getElementById('input-url-imagem').value;
      item.obra_imagem = (urlVal && urlVal.trim() !== "") ? urlVal.trim() : "";
      fecharEAtualizar(item);
  }

  function fecharEAtualizar(itemAtualizado) {
      if (typeof window.sincronizarAtualizacaoNuvem === "function") {
          window.sincronizarAtualizacaoNuvem(itemAtualizado);
      }
      if (typeof window.atualizarInterfaceEMapa === "function") {
          window.atualizarInterfaceEMapa();
      }
      const modal = document.getElementById('modal-imagem-mobiliario');
      if (modal) modal.remove();
      
      window.tempImagemBase64 = null;
      window.tempArquivoImagemPC = null;
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
          { id: 'volei', nome: 'Vôlei', arquivo: 'quadra_volei.glb', imagem: 'volei.png' },
          { id: 'beachTenis', nome: 'Beach Tennis', arquivo: 'quadra_beach_tennis.glb', imagem: 'beach.png' },
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

        // --- NOVO SISTEMA DE INVENTÁRIO AGRUPADO (SANFONAS) ---
        window.estadoSanfonas = {}; // Guarda quais grupos estão abertos/fechados

        // --- DICIONÁRIO INTELIGENTE DE GAVETAS ---
        window.obterNomeGaveta = function(arquivo_glb) {
            const arq = (arquivo_glb || "").toLowerCase();
            
            // 1. Equipamentos base
            if (arq.includes('bench')) return "Bancos";
            if (arq.includes('lamp') || arq.includes('streetlight')) return "Iluminação (Postes)";
            if (arq.includes('trash') || arq.includes('fountain')) return "Lixeiras e Bebedouros";
            
            // 2. Estruturas e Ambientes
            if (arq.includes('toilet') || arq.includes('vestiario')) return "Banheiros e Vestiários";
            if (arq.includes('statue') || arq.includes('monument')) return "Monumentos Históricos";
            if (arq.includes('chess')) return "Mesas de Jogo (Dama/Xadrez)";
            if (arq.includes('court') || arq.includes('sahasi') || arq.includes('bocha') || arq.includes('tenis') || arq.includes('volei') || arq.includes('beach')) return "Quadras Esportivas e Canchas";
            if (arq.includes('skate') || arq.includes('halfpipe')) return "Pistas de Skate";
            if (arq.includes('play') || arq.includes('seesaw') || arq.includes('slide')) return "Playground Infantil";
            if (arq.includes('calisthenics') || arq.includes('gym') || arq.includes('academia')) return "Academia ao Ar Livre";
            if (arq.includes('barbecue') || arq.includes('churrasqueira')) return "Churrasqueiras";
            if (arq.includes('pergola') || arq.includes('estar')) return "Áreas de Estar e Pergolados";
            
            // 3. O FILTRO DE ÁRVORE FICA POR ÚLTIMO (Evita que s-tree-t caia aqui)
            if (arq.includes('tree')) return "Árvores e Vegetação";
            
            return "Outros Equipamentos";
        };

        window.renderizarHTMLInventario = function(termoPesquisa = "") {
          const divLista = document.getElementById('lista-itens-dinamica');
          divLista.innerHTML = '';
          
          let itens = window.bancoDeDadosItens.filter(i => i.praca === pracaAtivaId);

          itens = itens.filter(i => {
              if (i.arquivo_glb && i.arquivo_glb.includes("obra_em_andamento") && i.obra_status === "Concluído") {
                  return false; // Esconde e exclui o card da tela
              }
              return true; // Mantém todo o resto normal
          });

          if (window.filtroStatusAtivo !== 'Todos') {
              itens = itens.filter(i => i.status === window.filtroStatusAtivo);
          }

          itens = itens.filter(i => {
              const categoria = window.obterCategoriaItem(i.arquivo_glb);
              return window.visibilidadeCategorias[categoria];
          });
          
          if(termoPesquisa.trim() !== "") {
              const termo = termoPesquisa.toLowerCase();
              itens = itens.filter(i => i.nome.toLowerCase().includes(termo) || i.status.toLowerCase().includes(termo));
          }

          // AQUI ESTÁ O SEU AGRUPAMENTO, USANDO A INTELIGÊNCIA GLOBAL
          const grupos = {};
          itens.forEach(item => {
              const nomeGrupo = window.obterNomeGaveta(item.arquivo_glb);
              if(!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
              grupos[nomeGrupo].push(item);
          });

          // Monta o HTML com as Sanfonas
          for(const [nomeGrupo, itensGrupo] of Object.entries(grupos)) {
              const isAberto = termoPesquisa.trim() !== "" ? true : !!window.estadoSanfonas[nomeGrupo];
              const iconeSeta = isAberto ? '▼' : '▶';
              const displayClasses = isAberto ? 'block' : 'hidden';

              let htmlGrupo = `
              <div class="mb-3 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <button onclick="window.toggleGrupoInventario('${nomeGrupo}')" class="w-full flex justify-between items-center p-3 bg-green-50/50 hover:bg-green-100/50 border-b border-gray-100 transition">
                   <span class="font-bold text-sm text-green-900 flex items-center gap-2">
                     ${nomeGrupo} <span class="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full">${itensGrupo.length}</span>
                   </span>
                   <span class="text-xs text-green-700 font-bold">${iconeSeta}</span>
                </button>
                <div class="${displayClasses} p-2 bg-gray-50 space-y-2 max-h-[40vh] overflow-y-auto">
              `;

              itensGrupo.forEach(item => {
                  htmlGrupo += `
                    <div id="card-item-${item.id}" class="bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-all duration-300">
                      
                      <!-- AQUI ESTÁ A CHAMADA DA CÂMERA (focarObjetoNoMapa) -->
                      <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                        <!-- Permite que o nome do item quebre linha e não empurre os botões para fora -->
                        <div class="flex items-start gap-2 flex-1 cursor-pointer group pr-2 overflow-hidden" onclick="window.focarObjetoNoMapa(${item.id})" title="Ver no Mapa">
                          <span class="font-bold text-xs text-gray-800 group-hover:text-purple-600 transition break-words whitespace-normal leading-tight">${item.nome}</span>
                          <span class="text-[9px] text-gray-400 bg-gray-100 px-1.5 rounded shrink-0 mt-0.5">📍 Localizar</span>
                        </div>
                        
                        <!-- Agrupa os ícones de ação e impede que eles sumam -->
                        <div class="flex flex-wrap gap-1 shrink-0 justify-end">
                            <button onclick="editarNomeItem(${item.id})" class="text-gray-400 hover:text-green-600 transition p-1" title="Editar Nome">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                            </button>
                            <button onclick="toggleMenu3D(${item.id})" class="${idMenu3DAberto === item.id ? 'text-green-600' : 'text-gray-400'} hover:text-green-600 transition p-1" title="Ajustes 3D">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                            </button>
                            <button onclick="window.abrirModalImagem('${item.id}')" class="text-gray-400 hover:text-green-600 transition p-1" title="Alterar Imagem">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
                            </button>
                            <button onclick="deletarItem(${item.id})" class="text-red-400 hover:text-red-600 transition p-1" title="Excluir">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            </button>
                        </div>
                      </div>
                      
                      <!-- Agrupa Status e Mover, permitindo quebra de linha se a tela for muito pequena -->
                      <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        <button onclick="mudarStatus(${item.id})" class="text-[9px] font-bold px-2 py-1.5 rounded-lg transition shrink-0 ${item.status === 'OK' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}">${item.status} ↻</button>
                        <button onclick="ativarModoMover(${item.id})" class="text-[9px] font-bold px-2 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition shrink-0">📍 Mover</button>
                      </div>

                      <div class="${idMenu3DAberto === item.id ? 'block' : 'hidden'} mt-3 pt-3 border-t border-gray-100 space-y-2 animate-fade-in">
                         <div class="flex flex-col gap-1 bg-gray-50 p-1.5 rounded border border-gray-100">
                          <div class="flex justify-between items-center mb-0.5"><span class="text-[9px] font-bold text-gray-500">TAMANHO</span><span class="text-[9px] text-gray-400 font-mono" id="val-escala-${item.id}">${(item.escala || 1).toFixed(2)}x</span></div>
                          <input type="range" min="0.1" max="5" step="0.05" value="${item.escala || 1}" oninput="aplicarAjuste3D(${item.id}, 'escala', this.value, false)" onchange="aplicarAjuste3D(${item.id}, 'escala', this.value, true)" class="w-full accent-purple-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                        </div>
                        <div class="flex flex-col gap-1 bg-gray-50 p-1.5 rounded border border-gray-100">
                          <div class="flex justify-between items-center mb-0.5"><span class="text-[9px] font-bold text-gray-500">GIRO HORIZONTAL</span><span class="text-[9px] text-gray-400 font-mono" id="val-rotacao-${item.id}">${item.rotacao || 0}°</span></div>
                          <input type="range" min="0" max="360" step="1" value="${item.rotacao || 0}" oninput="aplicarAjuste3D(${item.id}, 'rotacao', this.value, false)" onchange="aplicarAjuste3D(${item.id}, 'rotacao', this.value, true)" class="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                        </div>
                        <div class="flex flex-col gap-1 bg-gray-50 p-1.5 rounded border border-gray-100">
                          <div class="flex justify-between items-center mb-0.5"><span class="text-[9px] font-bold text-gray-500">INCLINAÇÃO (Frente/Trás)</span><span class="text-[9px] text-gray-400 font-mono" id="val-inclinacao-${item.id}">${item.inclinacao || 0}°</span></div>
                          <input type="range" min="-90" max="90" step="1" value="${item.inclinacao || 0}" oninput="aplicarAjuste3D(${item.id}, 'inclinacao', this.value, false)" onchange="aplicarAjuste3D(${item.id}, 'inclinacao', this.value, true)" class="w-full accent-orange-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                        </div>
                        <!-- NOVO SLIDER DE ROLAGEM LATERAL -->
                        <div class="flex flex-col gap-1 bg-gray-50 p-1.5 rounded border border-gray-100">
                          <div class="flex justify-between items-center mb-0.5"><span class="text-[9px] font-bold text-gray-500">TOMBAR (Esquerda/Direita)</span><span class="text-[9px] text-gray-400 font-mono" id="val-rolagem-${item.id}">${item.rolagem || 0}°</span></div>
                          <input type="range" min="-90" max="90" step="1" value="${item.rolagem || 0}" oninput="aplicarAjuste3D(${item.id}, 'rolagem', this.value, false)" onchange="aplicarAjuste3D(${item.id}, 'rolagem', this.value, true)" class="w-full accent-yellow-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                        </div>
                        <div class="flex flex-col gap-1 bg-gray-50 p-1.5 rounded border border-gray-100">
                          <div class="flex justify-between items-center mb-0.5"><span class="text-[9px] font-bold text-gray-500">ALTURA (Elevação)</span><span class="text-[9px] text-gray-400 font-mono" id="val-altitude-${item.id}">${(item.altitude || 0).toFixed(1)}m</span></div>
                          <input type="range" min="-5" max="20" step="0.1" value="${item.altitude || 0}" oninput="aplicarAjuste3D(${item.id}, 'altitude', this.value, false)" onchange="aplicarAjuste3D(${item.id}, 'altitude', this.value, true)" class="w-full accent-green-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                        </div>
                      </div>
                    </div>
                  `;
              });

              htmlGrupo += `</div></div>`; 
              divLista.innerHTML += htmlGrupo;
          }
        };

        window.toggleGrupoInventario = function(nomeGrupo) {
          // Inverte o status de aberto/fechado na memória
          window.estadoSanfonas[nomeGrupo] = !window.estadoSanfonas[nomeGrupo];
          // Recarrega o HTML mantendo o texto da pesquisa (se houver)
          const termoInput = document.getElementById('input-pesquisa-itens');
          window.renderizarHTMLInventario(termoInput ? termoInput.value : "");
        };

        window.filtrarItensInventario = function(termo) {
          // Como essa função só altera o HTML, o mapa 3D não vai piscar nem recarregar os modelos atoa!
          window.renderizarHTMLInventario(termo);
        };

        // --- LÓGICA DO FILTRO DE STATUS ---
        window.filtroStatusAtivo = 'Todos'; // Inicia mostrando tudo

        window.aplicarFiltroStatus = function(status) {
          window.filtroStatusAtivo = status;
          
          const btnTodos = document.getElementById('btn-filtro-todos');
          const btnOk = document.getElementById('btn-filtro-ok');
          const btnConserto = document.getElementById('btn-filtro-conserto');

          // 1. Desliga todos (Visual inativo padrão)
          const classeInativo = "bg-white text-gray-500 border-gray-200";
          btnTodos.className = `flex-1 text-[10px] font-bold py-1.5 rounded-full transition border hover:bg-gray-100 ${classeInativo}`;
          btnOk.className = `flex-1 text-[10px] font-bold py-1.5 rounded-full transition border hover:bg-green-50 hover:text-green-700 ${classeInativo}`;
          btnConserto.className = `flex-1 text-[10px] font-bold py-1.5 rounded-full transition border hover:bg-red-50 hover:text-red-700 ${classeInativo}`;

          // 2. Liga apenas o selecionado
          if (status === 'Todos') {
            btnTodos.className = "flex-1 text-[10px] font-bold py-1.5 rounded-full transition bg-gray-800 text-white shadow-sm border border-gray-800";
          } else if (status === 'OK') {
            btnOk.className = "flex-1 text-[10px] font-bold py-1.5 rounded-full transition bg-green-100 text-green-700 shadow-sm border border-green-200";
          } else if (status === 'Necessita Conserto') {
            btnConserto.className = "flex-1 text-[10px] font-bold py-1.5 rounded-full transition bg-red-100 text-red-700 shadow-sm border border-red-200";
          }

          // 3. Manda redesenhar a tela inteira (Mapa e Lista)
          window.atualizarInterfaceEMapa();
        };

        // --- LÓGICA DO FILTRO DE VISIBILIDADE 3D (CATEGORIAS) ---
        window.visibilidadeCategorias = { vegetacao: true, mobiliario: true, estrutura: true };

        // Inteligência para classificar os itens automaticamente pelo nome do arquivo GLB
        window.obterCategoriaItem = function(arquivo_glb) {
          const arq = (arquivo_glb || "").toLowerCase();
          
          if (arq.includes('tree')) return 'vegetacao';
          
          if (arq.includes('court') || arq.includes('sahasi') || arq.includes('skate') || 
              arq.includes('play') || arq.includes('seesaw') || arq.includes('slide') || 
              arq.includes('gym') || arq.includes('calisthenics') || arq.includes('academia') || 
              arq.includes('barbecue') || arq.includes('pergola') || arq.includes('bocha') ||
              arq.includes('chess') || arq.includes('tenis')) {
            return 'estrutura';
          }
          
          return 'mobiliario'; // Se não for árvore nem estrutura gigante, é mobiliário padrão
        };

        window.toggleVisibilidade = function(categoria) {
          // Inverte o estado da categoria (Liga/Desliga)
          window.visibilidadeCategorias[categoria] = !window.visibilidadeCategorias[categoria];
          
          const btn = document.getElementById(`btn-vis-${categoria}`);
          const estaAtivo = window.visibilidadeCategorias[categoria];
          
          // Estilo visual: Se desligado, fica cinza apagado e com um risco no meio
          if (categoria === 'vegetacao') {
            btn.className = estaAtivo 
              ? "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 shadow-sm flex items-center justify-center gap-1" 
              : "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-white text-gray-400 border border-gray-200 hover:bg-gray-50 line-through opacity-70 flex items-center justify-center gap-1";
          } else if (categoria === 'mobiliario') {
            btn.className = estaAtivo 
              ? "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 shadow-sm flex items-center justify-center gap-1" 
              : "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-white text-gray-400 border border-gray-200 hover:bg-gray-50 line-through opacity-70 flex items-center justify-center gap-1";
          } else if (categoria === 'estrutura') {
            btn.className = estaAtivo 
              ? "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 shadow-sm flex items-center justify-center gap-1" 
              : "flex-1 text-[10px] font-bold py-1.5 rounded-lg transition bg-white text-gray-400 border border-gray-200 hover:bg-gray-50 line-through opacity-70 flex items-center justify-center gap-1";
          }
          
          // Manda o mapa e a lista se atualizarem!
          window.atualizarInterfaceEMapa();
        };

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

      // --- FUNÇÃO QUE DESENHA O ITEM ---
        function criarSimboloGLB(arquivo, escala = 1, rotacao = 0, inclinacao = 0, rolagem = 0, status = "OK") {
          // MÁGICA: Rede de segurança para registros antigos sem extensão
          if (!arquivo.toLowerCase().endsWith('.glb')) {
            arquivo += '.glb';
          }
          
          const caminhoArquivo = arquivo.includes('/') ? arquivo : "modelos/" + arquivo;
          
          const configuracaoObjeto = {
            type: "object",
            resource: { href: "./" + caminhoArquivo },
            height: 3 * escala, 
            heading: rotacao,     // Eixo Z (Giro horizontal)
            tilt: inclinacao,     // Eixo X (Para frente/trás)
            roll: rolagem         // NOVO: Eixo Y (Tombar para os lados)
          };

          // O FANTASMA CINZA: Mescla a textura original com um cinza translúcido
          if (status === "Necessita Conserto") {
            configuracaoObjeto.material = { color: [107, 114, 128, 0.80] }; 
          }

          return {
            type: "point-3d",
            symbolLayers: [configuracaoObjeto]
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

        // --- HOVER COM TOOLTIP CUSTOMIZADO E CONTORNO AZUL ---
        view.on("pointer-move", function(event) {
          const tooltip = document.getElementById('custom-tooltip');

          // Se estivermos adicionando ou movendo itens, esconde tudo
          if (modoInteracaoMapa !== null) {
            tooltip.classList.add('hidden');
            tooltip.classList.remove('flex');
            if (highlightHover) { highlightHover.remove(); highlightHover = null; }
            document.getElementById('mapa-container').style.cursor = 'crosshair';
            return;
          }

          view.hitTest(event, { include: graphicsLayer }).then(function(response) {
            // Verifica se achou algum gráfico E se ele tem o atributo "nome"
            const hitResult = response.results.find(res => res.graphic.attributes && res.graphic.attributes.nome);

            if (hitResult) {
              const graphicHovered = hitResult.graphic;
              
              // --- MÁGICA DO CONTORNO AZUL ---
              view.whenLayerView(graphicsLayer).then(function(layerView) {
                if (highlightHover) { highlightHover.remove(); }
                highlightHover = layerView.highlight(graphicHovered);
              });
              
              // 1. Preenche os Textos
              document.getElementById('tooltip-title').innerText = graphicHovered.attributes.nome;
              const statusLocal = graphicHovered.attributes.status || "OK";
              const corStatus = statusLocal === 'OK' ? 'text-green-600' : 'text-red-600';
              document.getElementById('tooltip-status').innerHTML = `Status: <b class="${corStatus}">${statusLocal}</b>`;
              
              // 2. Lógica da IMAGEM REAL
              const itemBanco = window.bancoDeDadosItens.find(i => i.id === graphicHovered.attributes.idVisual);
              const imgTooltip = document.getElementById('tooltip-image');
              
              let imgSrc = null;
              if (itemBanco) {
                  if (itemBanco.obra_imagem) imgSrc = itemBanco.obra_imagem;
                  else if (itemBanco.imagem) imgSrc = itemBanco.imagem; 
              }

              if (imgSrc) {
                  imgTooltip.src = imgSrc;
                  imgTooltip.classList.remove('hidden');
                  imgTooltip.classList.add('block');
              } else {
                  imgTooltip.classList.add('hidden');
                  imgTooltip.classList.remove('block');
              }

              // 3. A MÁGICA 3D: Pega o "meio" do objeto
              const pontoExatoColisao = hitResult.mapPoint;
              
// 4. Converte essa coordenada real para a tela
const telaCoord = view.toScreen(pontoExatoColisao);

// 5. Posiciona o balão perfeitamente (Mantém o código que já ajustamos)
tooltip.style.left = telaCoord.x + "px"; 
tooltip.style.top = (telaCoord.y - 30) + "px"; 
tooltip.style.transform = "translate(-50%, -100%)"; 
              
              tooltip.classList.remove('hidden');
              tooltip.classList.add('flex');
              document.getElementById('mapa-container').style.cursor = 'pointer';

            } else {
              // --- SE O MOUSE SAIR DO OBJETO, LIMPA TUDO ---
              if (highlightHover) {
                highlightHover.remove();
                highlightHover = null;
              }

              // Esconde o balão e volta o mouse ao normal
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
            
            // 🔴 A CORREÇÃO ESTÁ AQUI: Trocamos "id" por "idItemSendoMovido"
            const item = window.bancoDeDadosItens.find(i => String(i.id) === String(idItemSendoMovido));
            
            if (item) {
              const geometriaNova = event.mapPoint.clone();
              item.lon = geometriaNova.longitude || geometriaNova.x;
              item.lat = geometriaNova.latitude || geometriaNova.y;
              item.geometriaOriginal = geometriaNova;
              
              window.sincronizarAtualizacaoNuvem(item, geometriaNova); 
            }
            cancelarAcaoMapa();
            atualizarInterfaceEMapa();
          }
          else {
            view.hitTest(event).then(function(response) {
              
              // 1. CLIQUE NO OBJETO 3D: Apenas scrolla e destaca o card correspondente (SEM abrir a engrenagem)
              const objetoClicado = response.results.find(res => res.graphic.layer === graphicsLayer && res.graphic.attributes && res.graphic.attributes.idVisual);

              if (objetoClicado) {
                  const idObj = objetoClicado.graphic.attributes.idVisual;
                  const itemBanco = window.bancoDeDadosItens.find(i => i.id === idObj);

                  if (itemBanco) {
                      const nomeGrupo = window.obterNomeGaveta(itemBanco.arquivo_glb);
                      
                      if (document.getElementById('content-inventario').classList.contains('hidden')) {
                          document.getElementById('btn-inventario').click();
                      }

                      // Abre a sanfona correta, se estiver fechada
                      if (!window.estadoSanfonas[nomeGrupo]) {
                          window.estadoSanfonas[nomeGrupo] = true;
                          window.atualizarInterfaceEMapa(); // Redesenha a lista para abrir a gaveta
                      }

                      // Rola a tela até o card correspondente e aplica o efeito visual de foco (sem abrir sliders)
                      setTimeout(() => {
                          const card = document.getElementById(`card-item-${idObj}`);
                          if (card) {
                              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              card.classList.add('border-purple-500', 'ring-2', 'ring-purple-300', 'bg-purple-50/50');
                              setTimeout(() => card.classList.remove('border-purple-500', 'ring-2', 'ring-purple-300', 'bg-purple-50/50'), 2500);
                          }
                      }, 150); // delay para dar tempo de o HTML da sanfona abrir, se precisou

                      return; // Impede que o clique seja considerado um clique na "grama"
                  }
              }

              // 2. CLIQUE NA PRAÇA (Abre o Inventário da Praça inteira)
              const pracaClicadaHit = response.results.find(
                (resultado) => resultado.graphic.layer && resultado.graphic.layer.id === "pracas-parques"
              );

              if (pracaClicadaHit) {
                const atributos = pracaClicadaHit.graphic.attributes;
                const infoPraca = extrairIdENomePraca(atributos);
                
                if (infoPraca.id === pracaAtivaId) return;

                let lonVoo = event.mapPoint.longitude;
                let latVoo = event.mapPoint.latitude;
                
                if (infoPraca.id === "Matriz") { lonVoo = -51.2305; latVoo = -30.0338; }
                else if (infoPraca.id === "Alfandega") { lonVoo = -51.2295; latVoo = -30.0298; }
                else if (infoPraca.id === "Redencao") { lonVoo = -51.2185; latVoo = -30.0355; }
                else if (infoPraca.id === "Carlesso") { lonVoo = -51.194719; latVoo = -29.984137; }

                window.abrirGestaoPraca(infoPraca.id, infoPraca.nome, lonVoo, latVoo);
                
                if (document.getElementById('content-inventario').classList.contains('hidden')) {
                  document.getElementById('btn-inventario').click();
                }
              } else {
                // CLIQUE FORA (Volta para a lista global de praças)
                if (pracaAtivaId !== null) {
                  window.voltarParaListaPracas();
                }
              }
            });
          }
        });
      });
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
const btnDashboard = document.getElementById('btn-dashboard');

const contentIntro = document.getElementById('content-intro');
const contentMapa = document.getElementById('content-mapa');
const contentObras = document.getElementById('content-obras');
const contentInventario = document.getElementById('content-inventario');
const contentDashboard = document.getElementById('content-dashboard');

const painelConteudo = document.getElementById('painel-conteudo');
const textoPainelAtivo = document.getElementById('texto-painel-ativo');
const iconePainelAtivo = document.getElementById('icone-painel-ativo');

const buttons = [btnIntro, btnMapa, btnObras, btnInventario, btnDashboard];
const contents = [contentIntro, contentMapa, contentObras, contentInventario, contentDashboard];

// Dicionário de títulos para o cabeçalho da Gaveta
const infoPaineis = {
  'btn-intro': { texto: 'Início', icone: '' },
  'btn-mapa': { texto: 'Estilos de Mapa', icone: '' },
  'btn-obras': { texto: 'Gestão de Obras', icone: '' },
  'btn-inventario': { texto: 'Inventário 3D', icone: '' },
  'btn-dashboard': { texto: 'Dashboard', icone: '' } // NOVO
};

const wrapperGaveta = document.getElementById('wrapper-gaveta');
const barraLateral = document.getElementById('barra-lateral');

// Reseta o visual dos ícones (limpa tudo para garantir a troca de cor)
function resetTabs() {
  buttons.forEach(btn => {
    // Remove o verde forte (fechado) e o verde claro (ativo)
    btn.classList.remove('text-white', 'bg-[#1cca5b]', 'border-green-700', 'shadow-md', 'backdrop-blur-sm', 'bg-green-50', 'text-green-800', 'border-green-200', 'shadow-sm');
    // Deixa os botões inativos neutros para quando a gaveta estiver aberta
    btn.classList.add('text-gray-400', 'border-transparent', 'bg-transparent');
  });
  contents.forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('block');
  });
}

// Abre a Gaveta e EXPANDIR a Barra para o tamanho da tela
function switchTab(clickedBtn, contentToShow) {
  const isGavetaAberta = !wrapperGaveta.classList.contains('opacity-0');
  // Agora a verificação de "ativo" busca o tom do cabeçalho
  const isBotaoAtivo = clickedBtn.classList.contains('bg-green-50');

  // Interruptor: Fechar ao clicar no mesmo ícone
  if (isGavetaAberta && isBotaoAtivo) {
    window.minimizarPainel();
    return;
  }

  resetTabs();
  
  // BOTÃO ATIVO: Fica com o mesmo tom clarinho do cabeçalho (bg-green-50)
  clickedBtn.classList.remove('text-gray-400', 'border-transparent', 'bg-transparent');
  clickedBtn.classList.add('text-green-800', 'bg-green-50', 'border-green-200', 'shadow-sm');
  
  textoPainelAtivo.innerText = infoPaineis[clickedBtn.id].texto;
  iconePainelAtivo.innerText = infoPaineis[clickedBtn.id].icone;

  contentToShow.classList.remove('hidden');
  contentToShow.classList.add('block');
  
  wrapperGaveta.classList.remove('translate-x-12', 'opacity-0', 'pointer-events-none');
  
  barraLateral.classList.remove('top-1/2', '-translate-y-1/2', 'bg-transparent', 'border-transparent', 'shadow-none', 'py-3');
  barraLateral.classList.add('top-24', 'bottom-6', 'translate-y-0', 'rounded-r-2xl', 'bg-white/95', 'border-y', 'border-r', 'border-l-0', 'py-6', 'shadow-2xl', 'backdrop-blur-xl');
}

// Minimiza a Gaveta e ENCOLHE a Barra separando os botões
window.minimizarPainel = function() {
  wrapperGaveta.classList.add('translate-x-12', 'opacity-0', 'pointer-events-none');
  
  barraLateral.classList.remove('top-24', 'bottom-6', 'translate-y-0', 'rounded-r-2xl', 'bg-white/95', 'border-y', 'border-r', 'border-l-0', 'py-6', 'shadow-2xl', 'backdrop-blur-xl');
  barraLateral.classList.add('top-1/2', '-translate-y-1/2', 'bg-transparent', 'border-transparent', 'shadow-none', 'py-3');
  
  resetTabs();

  // BOTÕES INDIVIDUAIS: Ganham o verde mais forte quando estão flutuando no mapa
  buttons.forEach(btn => {
    btn.classList.remove('text-gray-400', 'border-transparent', 'bg-transparent');
    btn.classList.add('bg-[#15803d]', 'text-white', 'shadow-md', 'border-green-700', 'backdrop-blur-sm');
  });
};

// Eventos de clique nos ícones
btnIntro.addEventListener('click', () => switchTab(btnIntro, contentIntro));
btnMapa.addEventListener('click', () => switchTab(btnMapa, contentMapa));
btnObras.addEventListener('click', () => switchTab(btnObras, contentObras));
btnInventario.addEventListener('click', () => switchTab(btnInventario, contentInventario));

// NOVO EVENTO:
btnDashboard.addEventListener('click', () => {
    switchTab(btnDashboard, contentDashboard);
    window.renderizarDashboard(); // Recalcula os dados na hora de abrir!
});
switchTab(btnIntro, contentIntro);

// --- FOCO BIDIRECIONAL (Card -> Mapa) ---
        window.focarObjetoNoMapa = function(id) {
          // Acha o gráfico no mapa 3D
          const graphic = graphicsLayer.graphics.find(g => g.attributes && g.attributes.idVisual === id && g.attributes.tipo === "modelo");
          
          if (graphic) {
            // Voa a câmera para pertinho do objeto, focando nele de cima
            view.goTo({ target: graphic, zoom: 21, tilt: 60 }, { duration: 1500 });

            // Pisca o card de roxo para o usuário saber que conectou
            const card = document.getElementById(`card-item-${id}`);
            if (card) {
                card.classList.add('border-purple-500', 'ring-2', 'ring-purple-300');
                setTimeout(() => card.classList.remove('border-purple-500', 'ring-2', 'ring-purple-300'), 2000);
            }
          }
        };