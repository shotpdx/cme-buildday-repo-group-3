const C = {
  ink: "#111111",
  muted: "#515151",
  blue: "#2563FF",
  paleBlue: "#DDEAFF",
  paleBlue2: "#EAF2FF",
  teal: "#0F9F95",
  line: "#151515",
  white: "#FFFFFF",
};

function text(slide, ctx, value, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text: value,
    left: x,
    top: y,
    width: w,
    height: h,
    fontSize: opts.size ?? 18,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    typeface: opts.face ?? (opts.title ? ctx.fonts.title : ctx.fonts.body),
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    fill: opts.fill ?? "#00000000",
    line: opts.line ?? ctx.line(),
    name: opts.name,
  });
}

function line(slide, ctx, x1, y1, x2, y2, color = C.line, width = 1) {
  const shape = slide.shapes.add({
    geometry: "line",
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    line: { fill: color, width, style: "solid" },
    fill: "#00000000",
  });
  return shape;
}

function sectionHeader(slide, ctx, label, x, y, endX, labelWidth = 150) {
  line(slide, ctx, x, y + 9, x + 14, y + 9, C.line, 1.25);
  text(slide, ctx, label, x + 20, y, labelWidth, 24, {
    size: 16,
    color: C.blue,
    bold: true,
    face: ctx.fonts.title,
  });
  const ruleStart = x + 20 + labelWidth + 8;
  if (ruleStart < endX) {
    line(slide, ctx, ruleStart, y + 9, endX, y + 9, C.line, 1.25);
  }
}

function paragraph(slide, ctx, value, x, y, w, h, opts = {}) {
  return text(slide, ctx, value, x, y, w, h, {
    size: opts.size ?? 13.2,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    insets: { left: 0, right: 4, top: 0, bottom: 0 },
  });
}

function bullet(slide, ctx, value, x, y, w, opts = {}) {
  return text(slide, ctx, `- ${value}`, x, y, w, opts.h ?? 20, {
    size: opts.size ?? 12,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
  });
}

function boldLead(slide, ctx, lead, rest, x, y, w, h) {
  text(slide, ctx, lead, x, y, w, 16, { size: 12.7, bold: true });
  text(slide, ctx, rest, x, y + 14, w, h - 14, { size: 12.4, color: C.muted });
}

async function checkItem(slide, ctx, title, desc, x, y, w) {
  ctx.addShape(slide, {
    left: x,
    top: y + 1,
    width: 16,
    height: 16,
    geometry: "ellipse",
    fill: C.blue,
    line: ctx.line(C.blue, 0),
  });
  await ctx.addLucideIcon(slide, {
    icon: "Check",
    left: x + 3.6,
    top: y + 4,
    width: 9,
    height: 9,
    color: C.white,
    strokeWidth: 3,
  });
  text(slide, ctx, title, x + 26, y - 1, w - 26, 15, { size: 13, bold: true });
  text(slide, ctx, desc, x + 26, y + 15, w - 26, 22, { size: 11.5, color: C.muted });
}

function stage(slide, ctx, index, titleA, titleB, x, y, w, h, last = false) {
  ctx.addShape(slide, {
    left: x,
    top: y,
    width: w,
    height: h,
    fill: index % 2 === 0 ? C.paleBlue2 : C.paleBlue,
    line: ctx.line("#FFFFFF", 0),
  });
  if (!last) {
    ctx.addShape(slide, {
      geometry: "parallelogram",
      left: x + w - 8,
      top: y,
      width: 18,
      height: h,
      fill: C.white,
      line: ctx.line(C.white, 0),
    });
  }
  text(slide, ctx, `${titleA}\n${titleB}`, x + 18, y + 22, w - 34, 34, {
    size: 12,
    bold: true,
    color: index === 0 || index === 1 || index === 3 ? C.blue : C.ink,
  });
}

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  ctx.addShape(slide, {
    left: 0,
    top: 0,
    width: 1280,
    height: 720,
    fill: C.white,
    line: ctx.line(),
  });

  text(slide, ctx, "BECOME AN AI-DRIVEN MEDIA ENTERPRISE", 22, 18, 390, 18, {
    size: 13,
    color: "#5B5B5B",
    face: ctx.fonts.title,
  });
  text(slide, ctx, "AI-Powered Creative Command Center", 22, 58, 760, 42, {
    size: 37,
    bold: true,
    title: true,
  });
  text(
    slide,
    ctx,
    "Generate, evaluate, and activate governed personalized creative on Databricks to move from brief to market-ready campaigns faster and with more control.",
    22,
    102,
    810,
    54,
    { size: 23, color: C.ink },
  );
  text(slide, ctx, "Slalom + Databricks", 1010, 30, 250, 64, {
    size: 27,
    bold: true,
    align: "right",
    title: true,
  });

  const topY = 196;
  sectionHeader(slide, ctx, "THE CHALLENGE", 22, topY, 317, 140);
  paragraph(slide, ctx, "Personalized creative still moves through disconnected handoffs.", 22, 226, 286, 32, {
    size: 13.2,
    bold: true,
  });
  paragraph(
    slide,
    ctx,
    "Marketing teams must connect briefs, Customer 360 segments, approved assets, model experiments, policy reviews, and activation channels. Without a governed workflow, personalization gets slow, hard to audit, and risky to scale.",
    22,
    260,
    292,
    95,
  );

  sectionHeader(slide, ctx, "THE SOLUTION", 344, topY, 790, 150);
  paragraph(slide, ctx, "Introducing Creative Command Center", 344, 226, 420, 22, { size: 14.2 });
  paragraph(
    slide,
    ctx,
    "A Databricks App that turns campaign briefs, audience cohorts, governed assets, and AI generation into an auditable creative activation workflow. We combine:",
    344,
    254,
    430,
    54,
    { size: 12.8 },
  );
  bullet(slide, ctx, "Lakeflow + Unity Catalog data foundation", 344, 318, 420, { size: 12.5, bold: true, h: 15 });
  bullet(slide, ctx, "Vector Search over rights-aware creative assets", 344, 338, 420, { size: 12.5, bold: true, h: 15 });
  bullet(slide, ctx, "Model-assisted image/video generation and adaptation", 344, 358, 430, {
    size: 12.5,
    bold: true,
    h: 15,
  });
  bullet(slide, ctx, "Policy, brand, synthetic audience, and human approval gates", 344, 378, 450, {
    size: 12.5,
    bold: true,
    h: 18,
  });
  paragraph(slide, ctx, "to deliver faster, governed, personalized creative at campaign scale.", 344, 412, 430, 34, {
    size: 13.2,
  });

  sectionHeader(slide, ctx, "AGENTIC CREATIVE OPS", 827, topY, 1276, 218);
  paragraph(slide, ctx, "AI accelerates the loop. Humans control release.", 827, 226, 430, 22, {
    size: 13.2,
    bold: true,
  });
  bullet(slide, ctx, "Audience-driven generation from Customer 360 traits", 827, 253, 420, { size: 12.2, h: 15 });
  bullet(slide, ctx, "Governed retrieval with rights and usage metadata", 827, 272, 420, { size: 12.2, h: 15 });
  bullet(slide, ctx, "Synthetic audience and policy scoring before activation", 827, 291, 430, { size: 12.2, h: 15 });
  bullet(slide, ctx, "Full lineage from brief -> prompt -> model -> asset -> channel", 827, 310, 430, {
    size: 12.2,
    h: 15,
  });
  bullet(slide, ctx, "Repeatable delivery through Databricks Apps, DABs, and Lakeflow", 827, 331, 430, {
    size: 12.2,
    h: 18,
  });
  paragraph(
    slide,
    ctx,
    "This is not a one-off creative demo. It is a governed activation workflow for AI-powered campaign operations.",
    827,
    372,
    428,
    52,
    { size: 12.8 },
  );

  const lowerY = 466;
  sectionHeader(slide, ctx, "HOW IT WORKS", 22, lowerY, 682, 128);
  const bandY = 500;
  const bandH = 76;
  const stageW = 164.5;
  stage(slide, ctx, 0, "Brief and", "Audience", 22, bandY, stageW, bandH);
  stage(slide, ctx, 1, "Retrieve and", "Generate", 22 + stageW, bandY, stageW, bandH);
  stage(slide, ctx, 2, "Evaluate and", "Approve", 22 + stageW * 2, bandY, stageW, bandH);
  stage(slide, ctx, 3, "Activate and", "Learn", 22 + stageW * 3, bandY, stageW, bandH, true);

  bullet(slide, ctx, "Select campaign brief, objective, placements, regions, and audience cohorts", 32, 590, 144, {
    size: 9.6,
    h: 36,
  });
  bullet(slide, ctx, "Use Customer 360 traits, reach, LTV, lifecycle, and channel constraints", 32, 632, 144, {
    size: 9.6,
    h: 42,
  });

  bullet(slide, ctx, "Search governed base assets using Vector Search and approved usage metadata", 198, 590, 145, {
    size: 9.6,
    h: 42,
  });
  bullet(slide, ctx, "Generate image/video variants with selected model and brand guideline context", 198, 638, 145, {
    size: 9.6,
    h: 42,
  });

  bullet(slide, ctx, "Run policy, rights, brand, and synthetic audience evaluation", 364, 590, 145, {
    size: 9.6,
    h: 36,
  });
  bullet(slide, ctx, "Expose model, prompt, score rubric, transformation, and approval lineage", 364, 632, 145, {
    size: 9.6,
    h: 42,
  });

  bullet(slide, ctx, "Publish approved metadata and asset references to activation destinations", 530, 590, 145, {
    size: 9.6,
    h: 42,
  });
  bullet(slide, ctx, "Ask AI / Genie closes the loop across briefs, segments, variants, scores, and outcomes", 530, 638, 145, {
    size: 9.6,
    h: 42,
  });

  sectionHeader(slide, ctx, "WHAT YOU GET", 827, lowerY, 1268, 126);
  await checkItem(
    slide,
    ctx,
    "Faster Campaign Launch",
    "Brief-to-variant workflows replace manual handoffs and rework.",
    830,
    503,
    420,
  );
  await checkItem(
    slide,
    ctx,
    "Reduced Creative & Compliance Risk",
    "Rights, brand, policy, and human approval gates run before activation.",
    830,
    542,
    420,
  );
  await checkItem(
    slide,
    ctx,
    "Higher Personalization Quality",
    "Customer 360 traits and synthetic audience scoring guide creative choices.",
    830,
    581,
    420,
  );
  await checkItem(
    slide,
    ctx,
    "Auditable AI Operations",
    "Every asset keeps lineage across brief, prompt, model, transformation, and channel.",
    830,
    620,
    420,
  );
  await checkItem(
    slide,
    ctx,
    "Databricks-Native Foundation",
    "Apps, Lakeflow, Unity Catalog, Vector Search, Model Serving, Genie, and Delta.",
    830,
    659,
    420,
  );

  line(slide, ctx, 827, 704, 1268, 704, C.line, 1);
  text(slide, ctx, "Ready to activate personalized creative at scale? Let's talk.", 845, 707, 390, 14, {
    size: 10.8,
    color: C.ink,
  });

  return slide;
}
