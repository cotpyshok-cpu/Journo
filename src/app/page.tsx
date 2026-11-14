"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  Compass,
  Footprints,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  TrainFront,
} from "lucide-react";
import { JournoLogo } from "@/components/brand/JournoLogo";
import { AuthModal } from "@/components/landing/AuthModal";
import { Badge, Button, Card } from "@/components/ui/primitives";

const DEMO_STOPS = [
  {
    order: "H",
    title: "Highvill Astana (Home)",
    time: "08:30",
    meta: "Astana",
    mode: "Ready when you are",
    anchor: true,
  },
  {
    order: "1",
    title: "Product Demo Pitch · Astana Hub",
    time: "09:30",
    meta: "16 min by bus · or 32 min walk",
    mode: "Fixed meeting · 09:30–10:45",
    anchor: true,
  },
  {
    order: "2",
    title: "Pick up signed contract · Koktem Coffee",
    time: "11:02",
    meta: "14 min by bus · plenty of spare time",
    mode: "Flexible stop · 25 min",
    anchor: false,
  },
  {
    order: "3",
    title: "Client Lunch · Talan Towers",
    time: "13:00",
    meta: "5 min walk · easy stroll",
    mode: "Fixed meeting · 13:00–14:15",
    anchor: true,
  },
];

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F4EF] text-[#2F453B]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#DFDBD0] bg-[#F6F4EF]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Journo home">
            <JournoLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E766B]">
            <a href="#calendar-sync" className="hover:text-[#2F453B] transition-colors">
              Google Calendar Sync
            </a>
            <a href="#pricing" className="hover:text-[#2F453B] transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => setAuthOpen(true)}>
              Sign In
            </Button>
            <Link
              href="/app"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#C67D63] px-4 text-sm font-semibold text-white hover:bg-[#B26B52] transition-colors"
            >
              Try Live Demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DFDBD0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#2F453B]">
                <Compass className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
                <span>Your calm daily route &amp; budget planner · Astana</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#2F453B] leading-[1.08]">
                Errands, meetings, and daily budget —{" "}
                <span className="text-[#C67D63]">all in one calm plan.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#5E766B] leading-relaxed max-w-xl">
                Stop guessing when to leave or zigzagging across town. Journo fits your errands
                around fixed appointments using real walking, transit, driving, and taxi times —
                synced with your calendar.
              </p>

              {/* Two primary CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link
                  href="/app"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[#C67D63] px-6 text-base font-semibold text-white hover:bg-[#B26B52] transition-colors"
                >
                  Try Live Demo
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <a
                  href="/api/auth/google?intent=login&next=/app"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl border border-[#2F453B] bg-white px-5 text-base font-semibold text-[#2F453B] hover:bg-[#ECE9E1] transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  Continue with Google
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-[#5E766B]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                  Walk, transit, car &amp; taxi comparisons
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                  Works with Google &amp; Apple Calendar
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                  No sign-up needed to try
                </span>
              </div>
            </div>

            {/* Deep Forest Green Contrast Showcase Card */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl bg-[#2F453B] p-5 sm:p-6 text-[#F6F4EF] border border-[#3D564B]">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#3D564B]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#F6F4EF]/70">
                      Sample Day in Astana
                    </p>
                    <h2 className="font-display text-lg font-bold mt-0.5">
                      Your Morning Plan, Sorted
                    </h2>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#C67D63] px-3 py-1 text-xs font-bold text-white">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      24 min saved
                    </span>
                    <p className="text-xs text-[#F6F4EF]/75 mt-1">13.4 km total</p>
                  </div>
                </div>

                {/* Stylized Dashed Route Loop Illustration + Timeline */}
                <div className="relative mt-5 space-y-3">
                  {DEMO_STOPS.map((stop, idx) => (
                    <div key={stop.title} className="relative flex items-start gap-3.5">
                      {idx < DEMO_STOPS.length - 1 ? (
                        <div
                          aria-hidden="true"
                          className="absolute left-[15px] top-8 bottom-[-12px] w-0 border-l-2 border-dashed border-[#C67D63]"
                        />
                      ) : null}

                      <div
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          stop.anchor
                            ? "bg-[#F6F4EF] text-[#2F453B]"
                            : "bg-[#C67D63] text-white"
                        }`}
                      >
                        {stop.order}
                      </div>

                      <div className="flex-1 rounded-xl bg-[#3D564B]/70 px-3.5 py-2.5 border border-[#5E766B]/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#F6F4EF]">
                            {stop.title}
                          </span>
                          <span className="text-xs font-bold tabular-nums text-[#F6F4EF] bg-[#2F453B] px-2 py-0.5 rounded-md">
                            {stop.time}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#F6F4EF]/75">
                          <span>{stop.meta}</span>
                          <span>·</span>
                          <span className="text-[#E2C2B5] font-medium">{stop.mode}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-[#3D564B] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                    <span>Head out from Highvill Astana at <strong className="tabular-nums">09:14</strong></span>
                  </div>
                  <Link
                    href="/app?view=S11"
                    className="font-semibold text-[#E2C2B5] hover:text-white whitespace-nowrap"
                  >
                    See Live Day →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How Google Calendar Sync Works */}
        <section id="calendar-sync" className="border-t border-[#DFDBD0] bg-white/75 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-[#C67D63]">
                Google Calendar Sync
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1">
                How Google Calendar Sync turns meetings into ready-to-go routes
              </h2>
              <p className="mt-2 text-sm text-[#5E766B] leading-relaxed">
                Connect your calendar once in seconds. Journo reads your schedule safely, pins
                meeting places to your map, and fits errands neatly in between.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4E8E3] text-[#C67D63] font-bold text-sm">
                  1
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Private, Read-Only Access</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Sign in with Google with read-only permissions. Journo only looks at your busy
                  times and addresses — it never edits, deletes, or shares your events.
                </p>
              </Card>

              <Card>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECE9E1] text-[#2F453B] font-bold text-sm">
                  2
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Meetings Stay Locked In</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Calendar events with addresses stay fixed at their exact times. Even if you add a
                  spontaneous errand mid-day, your meetings stay completely protected.
                </p>
              </Card>

              <Card>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6F1EC] text-[#3F7A63] font-bold text-sm">
                  3
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Instant Updates &amp; Apple Calendar</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Moved a meeting in Google Calendar? Journo spots the update and refreshes your
                  travel times in one tap. You can also import Apple Calendar files anytime.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-[#DFDBD0] bg-white/60 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-[#C67D63]">
                Made for real life in the city
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1">
                Less time in transit, zero stress about running late
              </h2>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4E8E3] text-[#C67D63]">
                  <Route className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Smart Daily Ordering</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Automatically arranges your errands around fixed meetings in seconds, so you
                  never backtrack across town.
                </p>
              </Card>

              <Card>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECE9E1] text-[#2F453B]">
                  <div className="flex items-center gap-0.5">
                    <Footprints className="h-4 w-4" aria-hidden="true" />
                    <TrainFront className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Every Way to Travel</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Compare walking, bus, driving, and taxi times and costs side by side — and choose
                  whichever fits your day.
                </p>
              </Card>

              <Card>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4E8E3] text-[#C67D63]">
                  <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold mt-3 text-base">All Your Calendars</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Includes a built-in day planner plus easy syncing with Google Calendar, Apple
                  Calendar, and weekly routines.
                </p>
              </Card>

              <Card>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECE9E1] text-[#2F453B]">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold mt-3 text-base">Made for Changing Plans</h3>
                <p className="mt-1.5 text-sm text-[#5E766B]">
                  Need to stop by a pharmacy or grab coffee? Add errands mid-day, push a task by 10
                  minutes, and track your spending.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section (Free vs Pro) */}
        <section id="pricing" className="py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto">
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                Simple, transparent plans
              </h2>
              <p className="mt-2 text-sm text-[#5E766B]">
                Compare travel options and plan your day for free. Upgrade anytime for unlimited
                stops, calendar sync, and automatic schedule updates.
              </p>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              <Card className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold">Free</h3>
                    <Badge variant="neutral">Starter</Badge>
                  </div>
                  <p className="mt-3 font-display text-3xl font-extrabold tabular-nums">
                    $0 <span className="text-sm font-medium text-[#5E766B]">/ forever</span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#5E766B]">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                      Up to 5 routed stops per day
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                      Walk, transit, car &amp; taxi comparisons
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                      Built-in planner &amp; weekly routines
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#3F7A63]" aria-hidden="true" />
                      Evening time &amp; budget summary
                    </li>
                  </ul>
                </div>

                <Link
                  href="/app"
                  className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#DFDBD0] bg-[#ECE9E1] px-4 text-sm font-semibold text-[#2F453B] hover:bg-[#E3DFD5] transition-colors"
                >
                  Start Planning for Free
                </Link>
              </Card>

              <Card dark className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-[#F6F4EF]">Journo Pro</h3>
                    <Badge variant="coral">Most Popular</Badge>
                  </div>
                  <p className="mt-3 font-display text-3xl font-extrabold tabular-nums text-[#F6F4EF]">
                    $8 <span className="text-sm font-medium text-[#F6F4EF]/70">/ mo · or $70/yr</span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#F6F4EF]/85">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                      Unlimited daily tasks &amp; calendar stops
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                      Google Calendar &amp; Apple Calendar sync
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                      Automatic rerouting &amp; timely departure reminders
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                      7-day time savings &amp; budget insights
                    </li>
                  </ul>
                </div>

                <Link
                  href="/app?view=S15"
                  className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#C67D63] px-4 text-sm font-semibold text-white hover:bg-[#B26B52] transition-colors"
                >
                  Try Journo Pro
                </Link>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DFDBD0] py-8">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 text-xs text-[#5E766B]">
          <div className="flex items-center gap-3">
            <JournoLogo size="sm" />
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
              Astana, Kazakhstan
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app" className="hover:text-[#2F453B] font-medium">
              Open Planner
            </Link>
            <Link href="/app?onboarding=1" className="hover:text-[#2F453B] font-medium">
              Quick Setup
            </Link>
            <Link href="/app?view=S16" className="hover:text-[#2F453B] font-medium">
              Settings
            </Link>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
