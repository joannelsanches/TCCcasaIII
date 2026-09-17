const botaoMenu = document.querySelector('[data-menu]');
const menu = document.querySelector('.nav-links');

if (botaoMenu && menu) {
  botaoMenu.addEventListener('click', () => {
    const aberto = menu.classList.toggle('open');
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  });
}

document.querySelectorAll('[data-confirmar]').forEach((formulario) => {
  formulario.addEventListener('submit', (evento) => {
    if (!window.confirm(formulario.dataset.confirmar || 'Confirma esta ação?')) evento.preventDefault();
  });
});

document.querySelectorAll('[data-image-input]').forEach((entrada) => {
  entrada.addEventListener('change', () => {
    const arquivo = entrada.files?.[0];
    const formulario = entrada.closest('form');
    const imagem = formulario?.querySelector(entrada.dataset.previewTarget);
    const caixa = imagem?.closest('[data-preview-box]');
    if (!arquivo || !imagem || !caixa) return;
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!permitidos.includes(arquivo.type)) {
      entrada.value = '';
      window.alert('Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }
    imagem.src = URL.createObjectURL(arquivo);
    caixa.hidden = false;
  });
});

document.querySelectorAll('[data-rating]').forEach((componente) => {
  const radios = [...componente.querySelectorAll('input[type="radio"]')];
  const rotulos = [...componente.querySelectorAll('[data-value]')];
  const texto = componente.querySelector('.rating-text');
  const mostrar = (valor, definitivo = false) => {
    rotulos.forEach((rotulo) => rotulo.classList.toggle('active', Number(rotulo.dataset.value) <= valor));
    if (texto) texto.textContent = valor ? `${valor} de 5 estrelas${definitivo ? ' selecionadas' : ''}` : 'Nenhuma nota selecionada';
  };
  const selecionada = () => Number(radios.find((radio) => radio.checked)?.value || 0);
  rotulos.forEach((rotulo) => {
    rotulo.addEventListener('mouseenter', () => mostrar(Number(rotulo.dataset.value)));
    rotulo.addEventListener('click', () => mostrar(Number(rotulo.dataset.value), true));
  });
  componente.addEventListener('mouseleave', () => mostrar(selecionada(), Boolean(selecionada())));
  radios.forEach((radio) => radio.addEventListener('change', () => mostrar(Number(radio.value), true)));
  mostrar(selecionada(), Boolean(selecionada()));
});

const consultasCep = new WeakMap();

function preencherCampoSeDisponivel(formulario, nome, valor, somenteSeVazio = false) {
  const campo = formulario?.elements?.namedItem(nome);
  if (!campo || !valor || (somenteSeVazio && campo.value.trim())) return;
  campo.value = valor;
  campo.dispatchEvent(new Event('change', { bubbles: true }));
}

async function consultarCep(entrada) {
  const cep = entrada.value.replace(/\D/g, '');
  const grupo = entrada.closest('[data-cep-group]');
  const status = grupo?.querySelector('[data-cep-status]');
  const prefixo = grupo?.dataset.prefixoEndereco || entrada.name.replace(/Cep$/, '');
  const formulario = entrada.form;

  if (cep.length !== 8) {
    if (status) status.textContent = cep.length ? 'Digite os 8 números do CEP.' : '';
    return;
  }

  const consultaAnterior = consultasCep.get(entrada);
  if (consultaAnterior?.cep === cep) return;
  consultaAnterior?.controlador?.abort();
  const controlador = new AbortController();
  consultasCep.set(entrada, { cep, controlador });
  let consultaFalhou = false;
  entrada.setAttribute('aria-busy', 'true');
  if (status) {
    status.textContent = 'Consultando CEP...';
    status.classList.remove('erro', 'sucesso');
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controlador.signal,
      headers: { Accept: 'application/json' }
    });
    if (!resposta.ok) throw new Error('Falha ao consultar o CEP.');
    const endereco = await resposta.json();
    if (entrada.value.replace(/\D/g, '') !== cep) return;
    if (endereco.erro === true) {
      if (status) {
        status.textContent = 'CEP não encontrado. Você pode preencher o endereço manualmente.';
        status.classList.add('erro');
      }
      return;
    }

    preencherCampoSeDisponivel(formulario, `${prefixo}Logradouro`, endereco.logradouro);
    preencherCampoSeDisponivel(formulario, `${prefixo}Bairro`, endereco.bairro);
    preencherCampoSeDisponivel(formulario, `${prefixo}Cidade`, endereco.localidade);
    preencherCampoSeDisponivel(formulario, `${prefixo}Estado`, endereco.uf?.toUpperCase());
    preencherCampoSeDisponivel(formulario, `${prefixo}Complemento`, endereco.complemento, true);
    if (status) {
      status.textContent = 'Endereço encontrado. Confira os dados e informe o número.';
      status.classList.add('sucesso');
    }
  } catch (erro) {
    if (erro.name !== 'AbortError' && status) {
      consultaFalhou = true;
      status.textContent = 'Não foi possível consultar agora. Preencha o endereço manualmente.';
      status.classList.add('erro');
    }
  } finally {
    if (consultasCep.get(entrada)?.controlador === controlador) {
      entrada.removeAttribute('aria-busy');
      if (consultaFalhou) consultasCep.delete(entrada);
    }
  }
}

document.querySelectorAll('[data-cep]').forEach((entrada) => {
  let temporizador;
  entrada.addEventListener('input', () => {
    const numeros = entrada.value.replace(/\D/g, '').slice(0, 8);
    entrada.value = numeros.length > 5 ? `${numeros.slice(0, 5)}-${numeros.slice(5)}` : numeros;
    clearTimeout(temporizador);
    if (numeros.length !== 8) {
      consultasCep.get(entrada)?.controlador?.abort();
      consultasCep.delete(entrada);
    }
    if (numeros.length === 8) temporizador = setTimeout(() => consultarCep(entrada), 350);
  });
  entrada.addEventListener('blur', () => consultarCep(entrada));
});

document.querySelectorAll('[data-uf]').forEach((entrada) => {
  entrada.addEventListener('input', () => { entrada.value = entrada.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(); });
});

document.querySelectorAll('[data-group-required]').forEach((entrada) => {
  const grupo = entrada.dataset.groupRequired;
  const campos = [...document.querySelectorAll(`[data-group-required="${grupo}"]`)];
  const validar = () => {
    const marcado = campos.some((campo) => campo.checked);
    campos[0].setCustomValidity(marcado ? '' : 'Selecione pelo menos uma opção.');
  };
  campos.forEach((campo) => campo.addEventListener('change', validar));
  validar();
});

const modalidade = document.querySelector('[data-modalidade]');
const blocoEndereco = document.querySelector('[data-address-fields]');
if (modalidade && blocoEndereco) {
  const atualizarEndereco = () => {
    const remoto = modalidade.value === 'REMOTO';
    blocoEndereco.classList.toggle('address-optional', remoto);
    blocoEndereco.querySelectorAll('[data-endereco-campo]').forEach((campo) => {
      if (!campo.name.endsWith('Complemento')) campo.required = !remoto;
    });
  };
  modalidade.addEventListener('change', atualizarEndereco);
  atualizarEndereco();
}
