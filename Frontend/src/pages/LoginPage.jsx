function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>YFNC</h1>
        <h2>Login</h2>

        <form>
          <input type="text" placeholder="Username or email" />
          <input type="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>

        <p>Don&apos;t have an account? Register</p>
      </div>
    </div>
  );
}

export default LoginPage;