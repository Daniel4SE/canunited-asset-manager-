// ===== Initialize AOS (Animate On Scroll) =====
AOS.init({
    duration: 800,
    easing: 'ease-out-cubic',
    once: true,
    offset: 50,
});

// ===== Navbar Scroll Effect =====
const navbar = document.getElementById('navbar');
let lastScrollY = window.scrollY;

function handleNavbarScroll() {
    const currentScrollY = window.scrollY;
    
    if (currentScrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScrollY = currentScrollY;
}

window.addEventListener('scroll', handleNavbarScroll, { passive: true });

// ===== Mobile Menu =====
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });
}

// ===== Smooth Scroll for Anchor Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Counter Animation =====
function animateCounter(element, target, suffix = '') {
    const duration = 2000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

// Intersection Observer for Counter Animation
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            const target = parseInt(element.dataset.count);
            if (target) {
                animateCounter(element, target);
                counterObserver.unobserve(element);
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => {
    counterObserver.observe(el);
});

// ===== Pricing Toggle =====
const pricingToggle = document.getElementById('pricingToggle');
const monthlyPrices = document.querySelectorAll('.amount.monthly');
const yearlyPrices = document.querySelectorAll('.amount.yearly');
const toggleLabels = document.querySelectorAll('.toggle-label');

if (pricingToggle) {
    pricingToggle.addEventListener('change', () => {
        const isYearly = pricingToggle.checked;
        
        monthlyPrices.forEach(el => {
            el.style.display = isYearly ? 'none' : 'inline';
        });
        
        yearlyPrices.forEach(el => {
            el.style.display = isYearly ? 'inline' : 'none';
        });
        
        toggleLabels.forEach((label, index) => {
            if (index === 0) {
                label.classList.toggle('active', !isYearly);
            } else {
                label.classList.toggle('active', isYearly);
            }
        });
    });
}

// ===== Contact Form =====
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Loading state
        submitBtn.innerHTML = `
            <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </circle>
            </svg>
            Submitting...
        `;
        submitBtn.disabled = true;
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Success state
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            Submitted Successfully!
        `;
        submitBtn.style.background = '#10b981';
        
        // Reset form
        contactForm.reset();
        
        // Reset button after delay
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
        }, 3000);
    });
}

// ===== Parallax Effect for Hero Shapes =====
const shapes = document.querySelectorAll('.shape');

function parallaxShapes(e) {
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    shapes.forEach((shape, index) => {
        const speed = (index + 1) * 20;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        shape.style.transform = `translate(${x}px, ${y}px)`;
    });
}

document.addEventListener('mousemove', parallaxShapes);

// ===== Typing Effect for Hero Title =====
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// ===== Dashboard Preview Animation =====
function animateDashboard() {
    const previewCards = document.querySelectorAll('.preview-card');
    
    previewCards.forEach((card, index) => {
        const value = card.querySelector('.card-value');
        if (value) {
            const originalValue = parseInt(value.textContent);
            
            setInterval(() => {
                const variation = (Math.random() - 0.5) * 4;
                const newValue = Math.max(1, Math.round(originalValue + variation));
                
                value.style.transition = 'transform 0.3s ease';
                value.style.transform = 'scale(1.1)';
                
                setTimeout(() => {
                    value.textContent = newValue;
                    value.style.transform = 'scale(1)';
                }, 150);
            }, 3000 + index * 1000);
        }
    });
}

// Initialize dashboard animation
animateDashboard();

// ===== Chart Animation =====
function animateChart() {
    const chartPath = document.querySelector('.chart-line path');
    if (chartPath) {
        const length = chartPath.getTotalLength();
        chartPath.style.strokeDasharray = length;
        chartPath.style.strokeDashoffset = length;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    chartPath.style.transition = 'stroke-dashoffset 2s ease-out';
                    chartPath.style.strokeDashoffset = '0';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(chartPath);
    }
}

animateChart();

// ===== Testimonials Auto-scroll (Optional) =====
let testimonialIndex = 0;
const testimonials = document.querySelectorAll('.testimonial-card');

function autoScrollTestimonials() {
    if (window.innerWidth <= 1024 && testimonials.length > 1) {
        testimonials.forEach((card, index) => {
            card.style.display = index === testimonialIndex ? 'block' : 'none';
        });
        
        testimonialIndex = (testimonialIndex + 1) % testimonials.length;
    } else {
        testimonials.forEach(card => {
            card.style.display = 'block';
        });
    }
}

// Check on resize
window.addEventListener('resize', () => {
    autoScrollTestimonials();
});

// ===== Vendor Card Hover Effect =====
const vendorCards = document.querySelectorAll('.vendor-card');

vendorCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        const logo = card.querySelector('.vendor-logo svg circle');
        if (logo) {
            logo.style.transition = 'transform 0.3s ease';
            logo.style.transform = 'scale(1.1)';
        }
    });
    
    card.addEventListener('mouseleave', () => {
        const logo = card.querySelector('.vendor-logo svg circle');
        if (logo) {
            logo.style.transform = 'scale(1)';
        }
    });
});

// ===== Feature Cards Stagger Animation =====
const featureCards = document.querySelectorAll('.feature-card');

featureCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 100}ms`;
});

// ===== Scroll Progress Indicator =====
function createScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #14a800, #1dbf00);
        z-index: 9999;
        transition: width 0.1s ease;
    `;
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = `${progress}%`;
    }, { passive: true });
}

createScrollProgress();

// ===== Lazy Loading Images =====
const lazyImages = document.querySelectorAll('img[data-src]');

const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
        }
    });
});

lazyImages.forEach(img => imageObserver.observe(img));

// ===== Console Easter Egg =====
console.log(`
%c CANUnited Asset Manager %c
%c Multi-Vendor Electrical Asset Intelligence Platform %c

🔌 Unified Management | 🧠 Smart Predictions | 🔗 Multi-Vendor Compatible

Join us: contact@canunited.com
`, 
'background: #14a800; color: white; font-size: 20px; font-weight: bold; padding: 10px 20px; border-radius: 5px;',
'',
'color: #666; font-size: 14px;',
''
);

// ===== Performance Optimization =====
// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for resize events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Apply throttle to resize handlers
window.addEventListener('resize', throttle(() => {
    // Handle resize operations
}, 250));

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        // Disable animations for users who prefer reduced motion
        document.documentElement.style.setProperty('--transition', '0s');
        document.documentElement.style.setProperty('--transition-slow', '0s');
    }
    
    // Add loaded class for initial animations
    document.body.classList.add('loaded');
});
