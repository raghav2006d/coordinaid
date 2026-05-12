import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Calendar, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LandingPage = () => {
  const { user } = useAuth();

  const highlights = [
    {
      title: 'Skill-first allocation',
      description: 'Match volunteers by skill coverage and level, then refine with experience and availability.',
      icon: BrainCircuit,
    },
    {
      title: 'Organizer command center',
      description: 'Run allocations, replace volunteers, and view next-best candidates with one click.',
      icon: ShieldCheck,
    },
    {
      title: 'Proof-backed attendance',
      description: 'Volunteers submit proof, organizers verify, and performance scores update automatically.',
      icon: Calendar,
    },
  ];

  return (
    <div className="app-shell gradient-light min-h-screen">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.17]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-[#e4dcff]/60 blur-[120px]" />
        <div className="absolute right-[-160px] top-[200px] h-80 w-80 rounded-full bg-[#dcf8ee]/60 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-[35%] h-96 w-96 rounded-full bg-[#e9e3ff]/80 blur-[140px]" />
      </div>

      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 border-b border-[rgba(76,63,145,0.14)] bg-[rgba(250,247,255,0.9)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d1736] text-white">
              <Sparkles size={18} />
            </div>
            <span className="text-xl font-bold text-[#1d1736]">SmartVolunteer</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="rounded-2xl bg-[#1d1736] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-[#5b3cc4] hover:underline">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-2xl bg-[#1d1736] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#766e97]">
              AI volunteer allocation
            </p>
            <h1 className="text-5xl font-black leading-tight text-[#1d1736] md:text-6xl">
              Allocate volunteers with precision, not guesswork.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#5f5a7a]">
              SmartVolunteer turns skills, levels, and availability into confident event staffing.
              Organizers stay in control while volunteers get roles that fit.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {!user ? (
                <>
                  <Link
                    to="/register"
                    className="flex items-center gap-2 rounded-2xl bg-[#1d1736] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
                  >
                    Join as volunteer <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-2xl border border-[#ddd5fb] bg-white px-6 py-3 text-sm font-semibold text-[#5b3cc4] transition hover:bg-[#f1ecff]"
                  >
                    Organize events
                  </Link>
                </>
              ) : (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-2xl bg-[#1d1736] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
                >
                  Open dashboard <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="bright-grid rounded-[36px] border border-[rgba(76,63,145,0.14)] bg-[rgba(250,247,255,0.9)] p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">
                  Live allocation
                </span>
                <span className="rounded-full bg-[#e9e3ff] px-3 py-1 text-xs font-semibold text-[#5b3cc4]">
                  94% match
                </span>
              </div>
              <div className="space-y-4">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[24px] bg-white/80 p-4">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1ecff] text-[#5b3cc4]">
                          <Icon size={18} />
                        </div>
                        <h3 className="text-base font-semibold text-[#1d1736]">{item.title}</h3>
                      </div>
                      <p className="text-sm text-[#5f5a7a]">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute -bottom-8 -right-6 rounded-[24px] bg-[#1d1736] px-5 py-4 text-white shadow-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e4dcff]">Active volunteers</p>
              <p className="mt-1 text-2xl font-bold">1,024</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Events managed', value: '540+', icon: Calendar },
            { label: 'Assignments created', value: '6,800+', icon: Users },
            { label: 'Verified attendance', value: '98%', icon: ShieldCheck },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-[28px] border border-[rgba(76,63,145,0.14)] bg-white/80 p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef8f3] text-[#0f9f75]">
                  <Icon size={20} />
                </div>
                <p className="text-3xl font-black text-[#1d1736]">{stat.value}</p>
                <p className="mt-2 text-sm text-[#5f5a7a]">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#766e97]">Culture Preview</p>
            <h2 className="mt-2 text-3xl font-black text-[#1d1736]">Team-first moments that power better events</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: 'Group Discussion',
              image:
                'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Teamwork',
              image:
                'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Unity',
              image:
                'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Peaceful Coordination',
              image:
                'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Smooth Functioning',
              image:
                'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'AI-Assisted Planning',
              image:
                'https://images.unsplash.com/photo-1674027444485-cec3da58eef4?auto=format&fit=crop&w=1200&q=80',
            },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.06 }}
              className="hero-image h-56 overflow-hidden rounded-[28px] border border-[rgba(76,63,145,0.14)]"
              style={{ backgroundImage: `url(${item.image})` }}
            >
              <div className="flex h-full items-end p-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-white">{item.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-[#1d1736] py-20">
        <div className="mx-auto max-w-5xl px-6 text-center text-white">
          <h2 className="text-4xl font-black">Ready to staff your next event?</h2>
          <p className="mt-4 text-lg text-[#e4dcff]">
            Start with a volunteer profile or create your first event in minutes.
          </p>
          {!user && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#1d1736]"
              >
                Create account
              </Link>
              <Link
                to="/login"
                className="rounded-2xl border border-white/30 px-6 py-3 text-sm font-semibold text-white"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
