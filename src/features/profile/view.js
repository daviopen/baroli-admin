import { authProviderState, changeMyPassword, loadMyProfile, saveMyProfile } from '../../services/profile.service.js';
import { getCurrentSession } from '../../services/session.service.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function initials(name = '', email = '') {
  const source = String(name || email || 'U').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function providerLabel(state) {
  if (state.hasGoogle && state.hasPassword) return 'Google + e-mail e senha';
  if (state.hasGoogle) return 'Google';
  if (state.hasPassword) return 'E-mail e senha';
  return 'Conta autenticada';
}

export async function renderProfile(container) {
  const session = getCurrentSession();
  const provider = authProviderState(session?.authUser);

  container.innerHTML = `
    <section class="page-header profile-page-header">
      <div>
        <p class="eyebrow">Conta · Dados pessoais</p>
        <h1>Meu perfil</h1>
        <p>Gerencie seus dados pessoais e a segurança da sua conta Baroli.</p>
      </div>
    </section>

    <div id="profile-loading" class="profile-loading">Carregando seu perfil...</div>
    <div id="profile-content" class="profile-content" hidden>
      <section class="profile-card profile-hero">
        <div class="profile-hero-main">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar">
              <img id="profile-avatar-image" alt="Foto de perfil" referrerpolicy="no-referrer" hidden>
              <span id="profile-avatar-fallback" class="profile-avatar-fallback" aria-hidden="true">U</span>
            </div>
          </div>
          <div class="profile-identity">
            <span class="profile-section-kicker">Sua conta</span>
            <h2 id="profile-header-name">Meu perfil</h2>
            <p id="profile-header-email" class="profile-summary-email"></p>
            <div class="profile-access-summary">
              <span class="profile-role-badge" id="profile-role"></span>
              <span class="profile-provider-badge">${escapeHtml(providerLabel(provider))}</span>
            </div>
          </div>
        </div>
        ${provider.googlePhotoURL ? `
          <div class="profile-photo-actions">
            <button id="profile-use-google-photo" class="secondary compact" type="button">Usar foto do Google</button>
            <button id="profile-remove-photo" class="link-button" type="button">Remover foto</button>
          </div>` : ''}
      </section>

      <div class="profile-layout">
        <section class="profile-card profile-personal-card" aria-labelledby="profile-personal-title">
          <header class="profile-card-heading">
            <div>
              <span class="profile-section-kicker">Informações pessoais</span>
              <h2 id="profile-personal-title">Dados pessoais</h2>
              <p>Informações usadas para identificação e contato no ambiente administrativo.</p>
            </div>
          </header>

          <form id="profile-form">
            <div class="profile-form-grid">
              <label class="field full">Nome completo<input id="profile-name" type="text" maxlength="120" autocomplete="name" required></label>
              <label class="field">Data de nascimento<input id="profile-birth-date" type="date" autocomplete="bday"></label>
              <label class="field">Telefone / WhatsApp<input id="profile-phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel" placeholder="(61) 99999-9999"></label>
            </div>
            <div class="profile-form-footer">
              <span id="profile-save-status" class="profile-save-status" role="status" aria-live="polite">Tudo salvo</span>
              <button id="profile-save" class="primary" type="submit">Salvar alterações</button>
            </div>
          </form>
        </section>

        <div class="profile-side-stack">
          <section class="profile-card" aria-labelledby="profile-access-title">
            <header class="profile-card-heading compact">
              <div>
                <span class="profile-section-kicker">Conta</span>
                <h2 id="profile-access-title">Acesso</h2>
                <p>Informações vinculadas ao seu login.</p>
              </div>
            </header>
            <dl class="profile-access-list">
              <div><dt>E-mail de acesso</dt><dd id="profile-access-email">—</dd></div>
              <div><dt>Método de acesso</dt><dd>${escapeHtml(providerLabel(provider))}</dd></div>
            </dl>
          </section>

          <section class="profile-card" aria-labelledby="profile-security-title">
            <header class="profile-card-heading compact">
              <div>
                <span class="profile-section-kicker">Proteção da conta</span>
                <h2 id="profile-security-title">Segurança</h2>
                <p>Gerencie sua senha quando o acesso utilizar e-mail e senha.</p>
              </div>
            </header>

            ${provider.hasPassword ? `
              <form id="profile-password-form">
                <div class="profile-password-grid">
                  <label class="field">Senha atual<input id="profile-current-password" type="password" autocomplete="current-password" required></label>
                  <label class="field">Nova senha<input id="profile-new-password" type="password" minlength="8" autocomplete="new-password" required></label>
                  <label class="field">Confirmar nova senha<input id="profile-confirm-password" type="password" minlength="8" autocomplete="new-password" required></label>
                </div>
                <p class="profile-password-help">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.</p>
                <div class="profile-form-actions"><button class="secondary compact" type="submit">Alterar senha</button></div>
              </form>` : `
              <div class="profile-security-note">
                <span class="profile-security-icon" aria-hidden="true">G</span>
                <div><strong>Senha gerenciada pelo Google</strong><p>Esta conta entra pelo Google. A senha deve ser alterada nas configurações da Conta Google.</p></div>
              </div>`}
          </section>
        </div>
      </div>
    </div>
    <div id="profile-toast" class="toast" role="status" aria-live="polite" hidden></div>`;

  const loading = container.querySelector('#profile-loading');
  const content = container.querySelector('#profile-content');
  const form = container.querySelector('#profile-form');
  const saveStatus = container.querySelector('#profile-save-status');
  const toast = container.querySelector('#profile-toast');
  let profile;
  let photoURL = '';

  function notify(message, type = 'success') {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { toast.hidden = true; }, 4500);
  }

  function updateAvatar() {
    const image = container.querySelector('#profile-avatar-image');
    const fallback = container.querySelector('#profile-avatar-fallback');
    const source = photoURL || session?.authUser?.photoURL || '';
    fallback.textContent = initials(profile?.name, profile?.email || session?.authUser?.email);
    if (source) {
      image.src = source;
      image.hidden = false;
      fallback.hidden = true;
      image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    } else {
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  function fillProfile(data) {
    profile = data;
    photoURL = data.photoURL || '';
    const email = data.email || session?.authUser?.email || '';
    container.querySelector('#profile-name').value = data.name || '';
    container.querySelector('#profile-birth-date').value = data.birthDate || '';
    container.querySelector('#profile-phone').value = data.phone || '';
    container.querySelector('#profile-header-name').textContent = data.name || 'Meu perfil';
    container.querySelector('#profile-header-email').textContent = email;
    container.querySelector('#profile-access-email').textContent = email || '—';
    container.querySelector('#profile-role').textContent = data.profileType || (data.role === 'SUPER_ADMIN' ? 'ADM-SUPER' : data.role || 'Usuário');
    updateAvatar();
  }

  function markDirty() {
    saveStatus.textContent = 'Alterações não salvas';
    saveStatus.dataset.state = 'dirty';
  }

  form.addEventListener('input', markDirty);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = container.querySelector('#profile-save');
    button.disabled = true;
    saveStatus.textContent = 'Salvando...';
    try {
      const saved = await saveMyProfile({
        name: container.querySelector('#profile-name').value,
        birthDate: container.querySelector('#profile-birth-date').value,
        phone: container.querySelector('#profile-phone').value,
        photoURL
      });
      fillProfile({ ...profile, ...saved });
      saveStatus.textContent = 'Tudo salvo';
      saveStatus.dataset.state = 'saved';
      notify('Perfil atualizado com sucesso.');
      globalThis.dispatchEvent(new CustomEvent('baroli:profile-updated', { detail: saved }));
    } catch (error) {
      saveStatus.textContent = 'Não foi possível salvar';
      saveStatus.dataset.state = 'error';
      notify(error?.message || 'Não foi possível salvar seu perfil.', 'error');
    } finally { button.disabled = false; }
  });

  container.querySelector('#profile-use-google-photo')?.addEventListener('click', () => {
    photoURL = provider.googlePhotoURL;
    updateAvatar();
    markDirty();
  });
  container.querySelector('#profile-remove-photo')?.addEventListener('click', () => {
    photoURL = '';
    updateAvatar();
    markDirty();
  });

  container.querySelector('#profile-password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await changeMyPassword(
        container.querySelector('#profile-current-password').value,
        container.querySelector('#profile-new-password').value,
        container.querySelector('#profile-confirm-password').value
      );
      event.currentTarget.reset();
      notify('Senha alterada com sucesso.');
    } catch (error) {
      const message = error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password'
        ? 'A senha atual está incorreta.'
        : error?.message || 'Não foi possível alterar a senha.';
      notify(message, 'error');
    } finally { button.disabled = false; }
  });

  try {
    fillProfile(await loadMyProfile());
    content.hidden = false;
  } catch (error) {
    loading.textContent = error?.message || 'Não foi possível carregar seu perfil.';
    return;
  } finally {
    if (!content.hidden) loading.hidden = true;
  }
}
