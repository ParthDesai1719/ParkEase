import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getDashboardRoute, getRoleCode } from '../auth/ProtectedRoute';
import { useAuthStore } from '../../stores/authStore';

/**
 * SplashScreen Component
 *
 * Implements the authoritative ParkEase Initial Loading / Splash Screen
 * specified in finalproject-5 Section "INITIAL PARKEase LOADING / SPLASH SCREEN".
 *
 * Sequence:
 * 1. Displays the centered ParkEase logo matching the active theme.
 * 2. Applies a subtle glowing/pulsing animation.
 * 3. Initializes application session / authentication in the background.
 * 4. Respects `prefers-reduced-motion` for accessibility.
 * 5. Smoothly fades out and transitions automatically to the Login page
 *    (or the role dashboard if already authenticated).
 */
interface SplashScreenProps {
  onComplete?: () => void;
  redirectTo?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, redirectTo }) => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const shouldReduceMotion = useReducedMotion();

  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // If the user prefers reduced motion, finish immediately when auth loading completes
    if (shouldReduceMotion) {
      if (!isLoading) {
        if (onComplete) {
          onComplete();
        } else {
          const destination =
            redirectTo ||
            (isAuthenticated && user ? getDashboardRoute(getRoleCode(user)) : '/login');
          navigate(destination, { replace: true });
        }
      }
      return;
    }

    // Minimum display duration (1.8s) for smooth branded introduction without unnecessary delay
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, user, shouldReduceMotion, navigate, onComplete, redirectTo]);

  const handleAnimationComplete = () => {
    if (isExiting) {
      if (onComplete) {
        onComplete();
      } else {
        const destination =
          redirectTo || (isAuthenticated && user ? getDashboardRoute(getRoleCode(user)) : '/login');
        navigate(destination, { replace: true });
      }
    }
  };

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {!isExiting && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground selection:bg-transparent"
        >
          <span className="sr-only">Loading ParkEase Smart Parking Platform</span>

          {/* Centered Glowing ParkEase Logo */}
          <motion.div
            animate={
              shouldReduceMotion
                ? {}
                : {
                    scale: [0.98, 1.02, 0.98],
                    filter: [
                      'drop-shadow(0 0 12px rgba(249, 115, 22, 0.2))',
                      'drop-shadow(0 0 32px rgba(249, 115, 22, 0.55))',
                      'drop-shadow(0 0 12px rgba(249, 115, 22, 0.2))',
                    ],
                  }
            }
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex flex-col items-center justify-center"
          >
            {/* Light Mode Logo Asset (official brand asset for light theme) */}
            <img
              src="/brand/splash-light.png"
              alt="ParkEase - Smart Parking Made Simple"
              className="h-16 w-auto max-w-[280px] object-contain sm:h-20 sm:max-w-sm md:h-24 md:max-w-md dark:hidden"
            />
            {/* Dark Mode Logo Asset (official brand asset for dark theme) */}
            <img
              src="/brand/splash-dark.png"
              alt="ParkEase - Smart Parking Made Simple"
              className="hidden h-16 w-auto max-w-[280px] object-contain sm:h-20 sm:max-w-sm md:h-24 md:max-w-md dark:block"
            />
          </motion.div>

          {/* Subtle glowing loading pulse indicator */}
          <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-muted/60 sm:w-40">
            <motion.div
              initial={{ x: '-100%' }}
              animate={shouldReduceMotion ? { x: '0%' } : { x: '100%' }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 1.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
              }
              className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
