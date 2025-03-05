// Client-side authentication logic
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const dashboardDiv = document.getElementById('dashboard');
    const loginMessage = document.getElementById('loginMessage');
    const signupMessage = document.getElementById('signupMessage');
    const dashboardContent = document.getElementById('dashboardContent');

    // Toggle between Login and Signup forms
    document.getElementById('showSignup')?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });

    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Signup Form Submit
    document.getElementById('signup')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                signupMessage.textContent = result.message;
                signupMessage.style.color = 'green';
                signupMessage.classList.remove('hidden');

                // Automatically switch to login
                setTimeout(() => {
                    signupForm.classList.add('hidden');
                    loginForm.classList.remove('hidden');
                }, 2000);
            } else {
                signupMessage.textContent = result.message;
                signupMessage.style.color = 'red';
                signupMessage.classList.remove('hidden');
            }
        } catch (error) {
            signupMessage.textContent = 'An error occurred';
            signupMessage.style.color = 'red';
            signupMessage.classList.remove('hidden');
        }
    });

    // Login Form Submit
    document.getElementById('login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // Store token and user info
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
		localStorage.setItem('isCachedData', result.isCachedData);
                // Show dashboard
                showDashboard();
            } else {
                loginMessage.textContent = result.message;
                loginMessage.style.color = 'red';
                loginMessage.classList.remove('hidden');
            }
        } catch (error) {
            loginMessage.textContent = 'An error occurred';
            loginMessage.style.color = 'red';
            loginMessage.classList.remove('hidden');
        }
    });

    // Logout Functionality
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
	localStorage.removeItem('isCachedData');
        // Hide dashboard, show login
        dashboardDiv.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Show Dashboard
    async function showDashboard() {
        const token = localStorage.getItem('token');
	const isCachedData = localStorage.getItem('isCachedData');
        if (!token) {
            loginForm.classList.remove('hidden');
            dashboardDiv.classList.add('hidden');
            return;
        }

        try {
            const response = await fetch('/api/dashboard', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
	   console.log(result);
            if (response.ok) {
                const user = JSON.parse(localStorage.getItem('user'));
                dashboardContent.innerHTML = `
                    <p>Welcome, ${user.username}!</p>
                    <p> Email: ${user.email}</p>
                    <p> Home: ${user.home}</p>
                    <p> Town: ${user.town}</p>
                    <p> City: ${user.city}</p>
                    <p> Position: ${user.position}</p>
                    <p>${result.message}</p>
		    <p> Is data cached : ${isCachedData} </p>
                `;

                // Hide login/signup, show dashboard
                loginForm.classList.add('hidden');
                signupForm.classList.add('hidden');
                dashboardDiv.classList.remove('hidden');
            } else {
                // Invalid token
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                loginForm.classList.remove('hidden');
                dashboardDiv.classList.add('hidden');
            }
        } catch (error) {
            // Network error or other issues
            loginForm.classList.remove('hidden');
            dashboardDiv.classList.add('hidden');
        }
    }

    // Check authentication on page load
    showDashboard();
});
