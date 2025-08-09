// backend/api/chat.js
// Lazy, optional model clients so local runs don't require API keys
let OpenAI = null;
let openai = null;
try {
	OpenAI = require('openai');
	if (process.env.OPENAI_API_KEY) {
		openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
} catch (_) {
	// openai package may be missing in minimal/local runs
}
let anthropic = null;
try {
	// Optional Anthropic support (Claude 3.5 Sonnet)
	anthropic = require('@anthropic-ai/sdk');
} catch (_) {
	// ignore missing dependency locally; Vercel will include if installed
}

// Local JSON knowledge (single source)
const halfData = require('../data/half-data.json');
const facultyData = halfData; // faculty also lives inside half-data

// Online sources to sanity-verify against (non-blocking, best-effort)
const ALLOWED_SOURCES = (halfData.source_domains && halfData.source_domains.length)
	? halfData.source_domains
	: ['https://cutm.ac.in', 'https://cutmap.ac.in', 'https://faculty.cutm.ac.in/'];

// ------------------------ helpers ------------------------
const norm = (s = '') =>
	String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s@.&()-]/g, ' ').replace(/\s+/g, ' ').trim();

const containsAll = (hay, needles = []) => needles.every(n => hay.includes(n));
const anyIncluded = (hay, needles = []) => needles.some(n => hay.includes(n));

// lightweight stopword list for scoring
const STOPWORDS = new Set(['the','is','are','am','a','an','of','to','in','on','for','at','by','with','and','or','who','whom','whose','what','which','where','when','how','about','me','tell','show','list','give','all']);
const contentWords = words => words.filter(w => w && w.length >= 3 && !STOPWORDS.has(w));
const campusNames = (halfData.campuses || []).map(c => c.name).filter(Boolean);
function extractCampus(message) {
	const m = norm(message);
	return campusNames.find(n => n && m.includes(norm(n))) || null;
}
const SHOULD_VERIFY = String(process.env.VERIFY_ONLINE || '').toLowerCase() === 'true';

function scoreFaculty(entry, qWords) {
	// higher weight for exact name / role matches; then dept/school/campus/email
	const fields = {
		name: 6,
		role: 5,
		department: 4,
		school: 3,
		campus: 3,
		email: 2,
	};
	let score = 0;
	for (const [k, w] of Object.entries(fields)) {
		const val = norm(entry[k]);
		if (!val) continue;
		// +2 if all words in query appear in the field; +1 if any appears
		if (containsAll(val, qWords)) score += w * 2;
		else if (anyIncluded(val, qWords)) score += w;
	}
	return score;
}

function detectListIntent(msg) {
	const m = norm(msg);
	// Faculty-specific list intent; avoid hijacking non-faculty lists like hostels/clubs
	const facultyHints = /\b(faculty|professors?|teachers?|staff|hod|head of department)\b/.test(m);
	const listVerbs = /\b(list|show|give|all)\b/.test(m);
	const deptHints = /\b(dept|department|cse|computer|mechanical|agri|agriculture|pharmacy|civil|electrical|ece|ai|ml|chemistry|applied\s+sciences)\b/.test(m);
	const wantsList = facultyHints || (listVerbs && deptHints);
	const campus = (halfData?.campuses || [])
		.map(c => c.name).find(cn => cn && m.includes(norm(cn)));
	// crude campus hints if not in data
	const campusAlt = ['paralakhemundi', 'bhubaneswar', 'rayagada', 'balangir', 'balasore', 'chatrapur', 'vizianagaram']
		.find(c => m.includes(c));
	const deptMatch = /(?:dept|department|cse|mechanical|agri|pharmacy|civil|electrical|ece|ai|ml)[\w\s-]*/.exec(m);
	return { wantsList, campus: campus || campusAlt, deptHint: deptMatch?.[0] || null };
}

function formatFacultyList(rows) {
	if (!rows?.length) return 'No matching faculty found.';
	return rows.slice(0, 20).map(f =>
		`• ${f.name} — ${f.role}${f.department ? ', ' + f.department : ''}${f.school ? ' | ' + f.school : ''}${f.campus ? ' | ' + f.campus : ''}${f.email ? ' | ' + f.email : ''}`
	).join('\n');
}

function findContacts(message) {
	const msg = norm(message);
	const rawWords = msg.split(' ').filter(Boolean);
	const campusNames = (halfData.campuses || []).map(c => norm(c.name)).filter(Boolean);
	const ignore = new Set(['campus','faculty','hostel','hostels','club','clubs','list','show','give','all',...campusNames]);
	const words = contentWords(rawWords.filter(w => !ignore.has(w)));
	const contactIntent = /(who\s+is|contact|phone|number|email|reach|call|vc|vice\s*chancel+or)/.test(msg);
	const wantsVC = /\b(vc|vice\s*chancel+or)\b/.test(msg);
	let best = null;
	let bestScore = 0;
		for (const c of (halfData.key_contacts || [])) {
		const role = norm(c.role);
		if (!role) continue;
		const roleTokens = contentWords(role.split(' '));
		const overlap = roleTokens.filter(t => words.includes(t)).length;
		let score = 0;
		if (overlap >= 2) score += 4; else if (overlap === 1) score += 2;
		// Name-based boosts: full-string match and token overlaps (ignoring titles)
		const cnameNorm = norm(c.name || '');
		if (msg.includes(cnameNorm)) score += 6; // strong boost for exact name
		const nameNoTitle = cnameNorm.replace(/\b(prof|professor|dr|mr|ms|mrs)\b/g, '').trim();
		if (nameNoTitle) {
			const nameTokens = nameNoTitle.split(' ').filter(Boolean);
			const tokenHits = nameTokens.filter(t => msg.includes(t)).length;
			if (tokenHits >= 2) score += 5; else if (tokenHits === 1) score += 3;
		}
		if (wantsVC && /vice\s*chancellor|\bvc\b/.test(role)) score += 10;
		if (contactIntent) score += 2;
		if (score > bestScore) { best = c; bestScore = score; }
	}
	return bestScore >= 4 ? best : null;
}

// Join a list of names with commas and a final 'and'
function formatList(items = []) {
	const list = items.filter(Boolean);
	if (!list.length) return '';
	if (list.length === 1) return list[0];
	return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

// Deterministic handling for promoter/founder queries
function listPromoters(message) {
	const m = norm(message);
	if (!/\b(promoters?|founders?)\b/.test(m)) return null;
	let names = Array.isArray(halfData.university_promoters) ? halfData.university_promoters.slice() : [];
	if (!names.length && Array.isArray(halfData.key_contacts)) {
		names = halfData.key_contacts
			.filter(c => /promoter|founder/i.test(c.role || ''))
			.map(c => c.name)
			.filter(Boolean);
	}
	// Ensure deterministic output order and remove duplicates
	const unique = Array.from(new Set(names));
	if (!unique.length) return `I don't know from the provided sources.`;
	return `The promoters of Centurion University are ${formatList(unique)}.`;
}

function extractProbableName(message) {
	const m = norm(message);
	// Prefer name after a title like prof/dr/mr/ms/mrs
	const m1 = /\b(?:prof|professor|dr|mr|ms|mrs)\.?\s+([a-z]+(?:\s+[a-z]+){1,3})\b/.exec(m);
	if (m1) return m1[1];
	// Otherwise, take the last 2-4 content words as a fallback name guess
	const words = contentWords(m.split(' '));
	if (words.length >= 2) {
		const tail = words.slice(-4).join(' ');
		return tail;
	}
	return null;
}

function retrieveFacultyScored(message) {
	const msg = norm(message);
	const qWords = msg.split(' ').filter(Boolean);
	const cw = contentWords(qWords);
	const probableName = extractProbableName(message);

	let scored = (facultyData.faculty || []).map(f => {
		const s = scoreFaculty(f, cw) + (probableName && norm(f.name).includes(probableName) ? 8 : 0);
		return { score: s, row: f };
	}).filter(x => x.score > 0);

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, 25);
}

function retrieveFaculty(message) {
	return retrieveFacultyScored(message).map(x => x.row);
}

function deptMatchesHint(deptHint, f) {
	if (!deptHint) return true;
	const hint = norm(deptHint);
	const field = norm(`${f.department || ''} ${f.school || ''}`);
	if (!field) return false;
	// quick synonyms
	const synonyms = [
		['cse', 'computer science', 'computer science engineering', 'cs', 'cs&e'],
		['ece', 'electronics and communication', 'electronics & communication'],
		['mech', 'mechanical'],
		['agri', 'agriculture', 'agricultural'],
	];
	for (const group of synonyms) {
		if (group.some(g => hint.includes(g))) {
			if (group.some(g => field.includes(g))) return true;
		}
	}
	return field.includes(hint);
}

function topKContextForLLM(message, K = 12) {
	// Build compact slices from JSON most likely relevant to the query
	const fac = retrieveFaculty(message).slice(0, 6);
	const contact = findContacts(message);
	const clubs = (halfData.clubs || []).filter(c => anyIncluded(norm(message), norm(c.name).split(' '))).slice(0, 3);
	const hostels = (halfData.hostels || []).filter(h => anyIncluded(norm(message), [norm(h.campus), norm(h.name)])).slice(0, 3);

	return {
		contacts: contact ? [contact] : [],
		faculty: fac,
		clubs,
		hostels
	};
}

// Simple deterministic lookups for known categories
function listHostelsByCampus(message) {
	const m = norm(message);
	if (!/hostel|accommodation|dorm|residence/.test(m)) return null;
	const campus = extractCampus(message);
	const rows = (halfData.hostels || []).filter(h => (campus ? norm(h.campus) === norm(campus) : true));
	if (!rows.length) return null;
	if (!campus) return { followup: true, kind: 'hostels' };
	const title = `Hostels at ${campus}`;
	const body = rows.map(h => `• ${h.name} — ${h.type || 'Type n/a'}${h.capacity ? ` (capacity: ${h.capacity})` : ''} | ${h.campus}`).join('\n');
	return `${title}\n${body}`;
}

function listClubs(message) {
	const m = norm(message);
	if (!/club|sports|yoga|music|drama|science/.test(m)) return null;
	const campus = extractCampus(message);
	const rows = (halfData.clubs || []).filter(c => (campus ? norm(c.campus).includes(norm(campus)) : true));
	if (!rows.length) return null;
	if (!campus) return { followup: true, kind: 'clubs' };
	const title = `Clubs at ${campus}`;
	const body = rows.map(c => `• ${c.name}${c.category ? ' — ' + c.category : ''}${c.campus ? ' | ' + c.campus : ''}${c.faculty_coordinator ? ' | Coord: ' + c.faculty_coordinator : ''}${c.contact ? ' | ' + c.contact : ''}${c.email ? ' | ' + c.email : ''}`).join('\n');
	return `${title}\n${body}`;
}

function campusAddresses(message) {
	const m = norm(message);
	if (!/address|location|where|hq|office/.test(m)) return null;
	const campus = extractCampus(message);
	if (!campus) return { followup: true, kind: 'address' };
	const viz = (halfData.campuses || []).find(c => norm(c.name).includes('vizianagaram'));
	const bhub = (halfData.campuses || []).find(c => norm(c.name).includes('bhubaneswar'));
	const lines = [];
	if (bhub?.contacts?.length) {
		const hq = bhub.contacts.find(x => /hq/i.test(x.role || ''));
		if (hq) lines.push(`Bhubaneswar HQ: ${hq.name}`);
	}
	if (viz?.contacts?.length) {
		viz.contacts.forEach(x => {
			lines.push(`${x.role}: ${x.name}${x.phone ? ' | ' + [].concat(x.phone).join(', ') : ''}`);
		});
	}
	if (!lines.length) return null;
	return lines.join('\n');
}

function listResearchCenters(message) {
	const m = norm(message);
	if (!/research\s*cent(er|re)s?|centers?\b/.test(m)) return null;
	const items = halfData.research_centers || [];
	if (!items.length) return null;
	return `Research Centers\n${items.map(i => '• ' + i).join('\n')}`;
}

function listLearningLabs(message) {
	const m = norm(message);
	if (!/labs?|laborator(y|ies)/.test(m)) return null;
	const items = halfData.learning_labs || [];
	if (!items.length) return null;
	return `Learning Labs\n${items.map(i => '• ' + i).join('\n')}`;
}

function listProductionUnits(message) {
	const m = norm(message);
	if (!/production|manufacturing|unit/.test(m)) return null;
	const items = halfData.production_units || [];
	if (!items.length) return null;
	return `Production Units\n${items.map(i => '• ' + i).join('\n')}`;
}

// Best-effort online verification without failing the response; adds a tiny wait
async function verifyWithSources(keywords = '', urls = []) {
	const toCheck = urls.length ? urls : ALLOWED_SOURCES;
	const kw = String(keywords || '').toLowerCase();

	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), 2500);
	try {
		for (const u of toCheck) {
			try {
				const res = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
				if (res.ok) {
					if (!kw) return true;
					const ct = (res.headers.get('content-type') || '').toLowerCase();
					if (ct.includes('text/html')) {
						const text = (await res.text()).toLowerCase();
						if (kw && text.includes(kw)) return true;
					} else {
						return true; // non-HTML but reachable
					}
				}
			} catch (_) {
				// ignore per-URL failures
			}
		}
	} finally {
		clearTimeout(timeout);
	}
	return false;
}

// ------------------------ handler ------------------------
module.exports = async (req, res) => {
	// CORS
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers',
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
	);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

	try {
		const { message, conversationHistory, history } = req.body || {};
		const conv = Array.isArray(conversationHistory) ? conversationHistory : (Array.isArray(history) ? history : []);
		if (!message) return res.status(400).json({ error: 'Message is required' });

		// 0) Plural promoters/founders question → deterministic list from JSON
		const promotersList = listPromoters(message);
		if (promotersList) {
			try { await verifyWithSources('promoters centurion university', []); } catch (_) {}
			return res.status(200).json({ reply: promotersList, source: 'local:key_contacts' });
		}

		// 1) Direct contact hit? Return immediately (fast path)
		const contact = findContacts(message);
			if (contact) {
				const line = `The ${contact.role} at Centurion University is ${contact.name}${contact.phone ? ' (Phone: ' + contact.phone + ')' : ''}.`;
				await verifyWithSources(contact.name, []);
				return res.status(200).json({ reply: line, source: 'local:key_contacts' });
			}

		// 2) Faculty retrieval (list or single)
		const { wantsList, campus, deptHint } = detectListIntent(message);
		const facScored = retrieveFacultyScored(message);
		const facMatches = facScored.map(x => x.row);

			if (wantsList && (facMatches.length || campus || deptHint)) {
				if (!campus && !deptHint) {
					const reply = 'Do you want the faculty list for a specific campus?';
					return res.status(200).json({ reply, source: 'followup', suggestedReplies: campusNames });
				}
			const filtered = facMatches.filter(f => {
				const passCampus = campus ? norm(f.campus).includes(campus) : true;
				const passDept = deptMatchesHint(deptHint, f);
				return passCampus && passDept;
			});
			const text = formatFacultyList(filtered.length ? filtered : facMatches);
			await verifyWithSources(deptHint || campus || 'faculty', []);
			return res.status(200).json({ reply: text, source: 'local:faculty' });
		}

		// 3) Deterministic lists for hostels/clubs/campus/centers/labs/units
			const hostelList = listHostelsByCampus(message);
			if (hostelList) {
				if (typeof hostelList === 'object' && hostelList.followup) {
					const reply = 'Which campus are you asking about for hostels?';
					return res.status(200).json({ reply, source: 'followup', suggestedReplies: campusNames });
				}
				await verifyWithSources('hostel ' + (campus || ''), []);
				return res.status(200).json({ reply: hostelList, source: 'local:hostels' });
			}
			const clubsList = listClubs(message);
			if (clubsList) {
				if (typeof clubsList === 'object' && clubsList.followup) {
					const reply = 'Which campus are you asking about for clubs?';
					return res.status(200).json({ reply, source: 'followup', suggestedReplies: campusNames });
				}
				await verifyWithSources('club ' + (campus || ''), []);
				return res.status(200).json({ reply: clubsList, source: 'local:clubs' });
			}
			const addressInfo = campusAddresses(message);
			if (addressInfo) {
				if (typeof addressInfo === 'object' && addressInfo.followup) {
					const reply = 'Which campus address do you need?';
					return res.status(200).json({ reply, source: 'followup', suggestedReplies: campusNames });
				}
				await verifyWithSources('address ' + (campus || ''), []);
				return res.status(200).json({ reply: addressInfo, source: 'local:campus-address' });
			}
		const centers = listResearchCenters(message);
			if (centers) {
				await verifyWithSources('research center', []);
				return res.status(200).json({ reply: centers, source: 'local:research-centers' });
			}
		const labs = listLearningLabs(message);
			if (labs) {
				await verifyWithSources('lab', []);
				return res.status(200).json({ reply: labs, source: 'local:learning-labs' });
			}
		const units = listProductionUnits(message);
			if (units) {
				await verifyWithSources('production unit', []);
				return res.status(200).json({ reply: units, source: 'local:production-units' });
			}

		// 3b) If single strong faculty match (stricter gating), answer locally
		const probableName = extractProbableName(message);
		const top = facScored[0];
		const second = facScored[1];
		const gap = top && second ? top.score - second.score : (top ? top.score : 0);
		const strongTop = top && (top.score >= 12 || (probableName && top.score >= 9) || gap >= 6);
		const clearSingle = (facScored.length === 1 || gap >= 6) && strongTop;
		if (clearSingle) {
			const f = facScored[0].row;
			const line = `${f.name} — ${f.role}${f.department ? ', ' + f.department : ''}${f.school ? ' | ' + f.school : ''}${f.campus ? ' | ' + f.campus : ''}${f.email ? ' | ' + f.email : ''}${f.phone ? ' | ' + f.phone : ''}${f.profile_url ? ' | ' + f.profile_url : ''}`;
			await verifyWithSources(f.name, f.profile_url ? [f.profile_url] : []);
			return res.status(200).json({ reply: line, source: 'local:faculty' });
		}

			// 4) Fall back to LLM with compact JSON context (strictly answer from context)
			// If JSON_ONLY=true, skip LLM and reply deterministically like the smoke test
				if (String(process.env.JSON_ONLY || '').toLowerCase() === 'true') {
				const context = topKContextForLLM(message);
					const system = `${halfData.system_prompt}`;
				const contextSummary =
						`Use ONLY Centurion University info from the provided Context. If an answer is not directly supported, reply with: "I don't know from the provided sources." Keep answers brief.\n` +
					`Context (from internal JSONs):\n` +
					`${JSON.stringify(context).slice(0, 11000)}\n` +
					`Permitted source domains: ${(halfData.source_domains || []).concat(facultyData.source_domains || []).join(', ')}`;
					await verifyWithSources('', []);
					return res.status(200).json({ reply: `I don't know from the provided sources.`, source: 'local-context' });
			}

			// Otherwise, attempt a model call using context-only constraints
		const context = topKContextForLLM(message);
			const system = `${halfData.system_prompt}`;
		const contextSummary =
				`Use ONLY Centurion University info from the provided Context. If an answer is not directly supported, reply with: "I don't know from the provided sources." Keep answers brief.\n` +
			`Context (from internal JSONs):\n` +
			`${JSON.stringify(context).slice(0, 11000)}\n` +
			`Permitted source domains: ${(halfData.source_domains || []).concat(facultyData.source_domains || []).join(', ')}`;

		const messages = [
			{ role: 'system', content: system + '\n\n' + contextSummary },
			...conv,
			{ role: 'user', content: message }
		];

		// Model provider switch
		const provider = (process.env.MODEL_PROVIDER || '').toLowerCase();
		let replyText = '';
		if (provider === 'anthropic' && anthropic && process.env.ANTHROPIC_API_KEY) {
			const Anthropic = anthropic.Anthropic || anthropic.default || anthropic;
			const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
			const model = process.env.MODEL_NAME || 'claude-3-5-sonnet-20240620';
			const resp = await client.messages.create({
				model,
				max_tokens: 700,
				temperature: 0.2,
				system,
				messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : m.role, content: String(m.content) }))
			});
			replyText = resp?.content?.[0]?.text?.trim() || '';
		} else if (openai && process.env.OPENAI_API_KEY) {
			const model = process.env.MODEL_NAME || 'gpt-4o-mini';
			try {
				const completion = await openai.chat.completions.create({
					model,
					messages,
					max_tokens: 700,
					temperature: 0.2
				});
				replyText = completion.choices[0]?.message?.content?.trim() || '';
			} catch (_) {
				// If OpenAI call fails (e.g., no network), proceed with empty reply
				replyText = '';
			}
		} else {
			// No model provider available locally; skip LLM call
			replyText = '';
		}

		const finalReply = replyText || `I don't know from the provided sources.`;
		try { await verifyWithSources(message || replyText, []); } catch (_) {}
		const src = (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY)
			? 'anthropic+local-context'
			: (openai && process.env.OPENAI_API_KEY ? 'openai+local-context' : 'local-context');
		return res.status(200).json({ reply: finalReply, source: src });
	} catch (err) {
		console.error('Error in chat API:', err);
		return res.status(500).json({ error: err.message || 'Server error' });
	}
};

