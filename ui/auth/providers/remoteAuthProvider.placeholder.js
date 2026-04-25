/**
 * 真实后端认证占位：定义未来可替换实现的接口，不连接任何服务。
 * 在接入 Supabase/Clerk/Firebase/自建 API 时替换为具体实现。
 * 同步的 loadSession / find* / upsert* 为路由与 authService 向后兼容而预留；未接后端前 upsert 会抛错。
 */
export const remoteAuthProviderPlaceholder = {
  type: "remote-placeholder",

  async signUp() {
    throw new Error("Remote auth provider is not configured yet.");
  },

  async signIn() {
    throw new Error("Remote auth provider is not configured yet.");
  },

  async signOut() {},

  async getSession() {
    return null;
  },

  async getCurrentUser() {
    return null;
  },

  async updateProfile() {
    throw new Error("Remote auth provider is not configured yet.");
  },

  /** 与 getSession 对应的同步视图占位（如接入 JWT/cookie 后可与异步合并） */
  loadSession() {
    return { v: 1, userId: null };
  },

  saveSession() {},

  findUserById() {
    return undefined;
  },

  findUserByEmail() {
    return undefined;
  },

  upsertUser() {
    throw new Error("Remote auth provider is not configured yet.");
  },

  loadAuthUsers() {
    return { v: 1, users: [] };
  },

  saveAuthUsers() {},
};
