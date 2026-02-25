import { Router, Response } from "express";
import { db } from "../db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { aiSkillsStore, aiSkillsAssignments } from "../../shared/schema";
import { AuthRequest, authenticateToken, requireAnyRole } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { source, category, search, is_active } = req.query;
    const consultantId = req.user?.role === "consultant" ? req.user.id : req.user?.consultantId;

    let conditions: any[] = [];

    if (source && source !== "all") {
      conditions.push(eq(aiSkillsStore.source, source as string));
    }
    if (category && category !== "all") {
      conditions.push(eq(aiSkillsStore.category, category as string));
    }
    if (is_active !== undefined && is_active !== "all") {
      conditions.push(eq(aiSkillsStore.isActive, is_active === "true"));
    }
    if (search) {
      conditions.push(
        or(
          ilike(aiSkillsStore.name, `%${search}%`),
          ilike(aiSkillsStore.displayTitle, `%${search}%`),
          ilike(aiSkillsStore.description, `%${search}%`)
        )
      );
    }

    const skills = await db
      .select()
      .from(aiSkillsStore)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiSkillsStore.createdAt));

    res.json(skills);
  } catch (error: any) {
    console.error("Error fetching skills:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/categories", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db
      .selectDistinct({ category: aiSkillsStore.category })
      .from(aiSkillsStore)
      .where(sql`${aiSkillsStore.category} IS NOT NULL`);
    res.json(result.map(r => r.category).filter(Boolean));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/active", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const assignments = await db
      .select({
        assignment: aiSkillsAssignments,
        skill: aiSkillsStore,
      })
      .from(aiSkillsAssignments)
      .innerJoin(aiSkillsStore, eq(aiSkillsAssignments.skillStoreId, aiSkillsStore.id))
      .where(
        and(
          eq(aiSkillsAssignments.userId, userId),
          eq(aiSkillsAssignments.isEnabled, true),
          eq(aiSkillsStore.isActive, true)
        )
      );

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const [skill] = await db
      .select()
      .from(aiSkillsStore)
      .where(eq(aiSkillsStore.id, req.params.id));

    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/custom", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayTitle, description, category, content } = req.body;
    const consultantId = req.user?.id;

    const skillId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const [skill] = await db
      .insert(aiSkillsStore)
      .values({
        skillId,
        name,
        displayTitle: displayTitle || name,
        description,
        source: "custom",
        category: category || "custom",
        content,
        consultantId,
        metadata: { author: req.user?.firstName + " " + req.user?.lastName },
      })
      .returning();

    res.json(skill);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayTitle, description, category, content } = req.body;

    const [skill] = await db
      .update(aiSkillsStore)
      .set({
        name: name,
        displayTitle: displayTitle,
        description: description,
        category: category,
        content: content,
        updatedAt: new Date(),
      })
      .where(eq(aiSkillsStore.id, req.params.id))
      .returning();

    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id/toggle", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await db
      .select({ isActive: aiSkillsStore.isActive })
      .from(aiSkillsStore)
      .where(eq(aiSkillsStore.id, req.params.id));

    if (!existing) return res.status(404).json({ error: "Skill not found" });

    const [skill] = await db
      .update(aiSkillsStore)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(aiSkillsStore.id, req.params.id))
      .returning();

    res.json(skill);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const [deleted] = await db
      .delete(aiSkillsStore)
      .where(eq(aiSkillsStore.id, req.params.id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Skill not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/assign", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { skillStoreId, userId, agentId } = req.body;

    const existing = await db
      .select()
      .from(aiSkillsAssignments)
      .where(
        and(
          eq(aiSkillsAssignments.skillStoreId, skillStoreId),
          eq(aiSkillsAssignments.userId, userId),
          agentId ? eq(aiSkillsAssignments.agentId, agentId) : sql`${aiSkillsAssignments.agentId} IS NULL`
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(aiSkillsAssignments)
        .set({ isEnabled: true })
        .where(eq(aiSkillsAssignments.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [assignment] = await db
      .insert(aiSkillsAssignments)
      .values({ skillStoreId, userId, agentId })
      .returning();

    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/assign/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const [deleted] = await db
      .delete(aiSkillsAssignments)
      .where(eq(aiSkillsAssignments.id, req.params.id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Assignment not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function fetchGitHubFile(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Accept: "application/vnd.github.v3.raw",
          "User-Agent": "Alessia-Platform",
        },
      }
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchGitHubDirectory(owner: string, repo: string, path: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Alessia-Platform",
        },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function parseSkillMdFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const frontmatter = match[1];
  const name = frontmatter.match(/name:\s*(.+)/)?.[1]?.trim();
  const description = frontmatter.match(/description:\s*(.+)/)?.[1]?.trim();
  return { name, description };
}

router.post("/import/github-official", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const skillDirs = await fetchGitHubDirectory("anthropics", "skills", "skills");
    const importedSkills: any[] = [];

    for (const dir of skillDirs) {
      if (dir.type !== "dir") continue;

      const skillContent = await fetchGitHubFile("anthropics", "skills", `skills/${dir.name}/SKILL.md`);
      if (!skillContent) continue;

      const { name, description } = parseSkillMdFrontmatter(skillContent);
      const skillId = `github_official_${dir.name}`;

      const existing = await db
        .select()
        .from(aiSkillsStore)
        .where(eq(aiSkillsStore.skillId, skillId));

      if (existing.length > 0) {
        const [updated] = await db
          .update(aiSkillsStore)
          .set({
            content: skillContent,
            description: description || existing[0].description,
            updatedAt: new Date(),
          })
          .where(eq(aiSkillsStore.id, existing[0].id))
          .returning();
        importedSkills.push({ ...updated, action: "updated" });
      } else {
        const dirContents = await fetchGitHubDirectory("anthropics", "skills", `skills/${dir.name}`);
        const fileList = dirContents.map((f: any) => f.name);

        const categoryMap: Record<string, string> = {
          pdf: "document_processing",
          docx: "document_processing",
          xlsx: "document_processing",
          pptx: "document_processing",
          "frontend-design": "development",
          "webapp-testing": "development",
          "mcp-builder": "development",
          "skill-creator": "meta",
          "brand-guidelines": "branding",
          "algorithmic-art": "creative",
          "canvas-design": "creative",
          "internal-comms": "communication",
        };

        const [skill] = await db
          .insert(aiSkillsStore)
          .values({
            skillId,
            name: name || dir.name,
            displayTitle: name || dir.name,
            description: description || `Official Anthropic skill: ${dir.name}`,
            source: "github_official",
            category: categoryMap[dir.name] || "general",
            content: skillContent,
            metadata: {
              repoUrl: `https://github.com/anthropics/skills/tree/main/skills/${dir.name}`,
              fileList,
              author: "Anthropic",
            },
          })
          .returning();
        importedSkills.push({ ...skill, action: "created" });
      }
    }

    res.json({
      success: true,
      imported: importedSkills.length,
      skills: importedSkills,
    });
  } catch (error: any) {
    console.error("Error importing from GitHub official:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/import/github-community", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const readmeContent = await fetchGitHubFile("travisvn", "awesome-claude-skills", "README.md");
    if (!readmeContent) {
      return res.status(500).json({ error: "Could not fetch community skills README" });
    }

    const skillLinks: Array<{ name: string; url: string; description: string; category: string }> = [];

    const githubLinkRegex = /\[([^\]]+)\]\((https:\/\/github\.com\/[^\)]+)\)\s*[-–—]\s*(.+)/g;
    let match;
    let currentCategory = "general";

    const lines = readmeContent.split("\n");
    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headerMatch) {
        currentCategory = headerMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 50);
      }

      const linkMatch = line.match(/\[([^\]]+)\]\((https:\/\/github\.com\/[^\)]+)\)\s*[-–—:]\s*(.+)/);
      if (linkMatch) {
        skillLinks.push({
          name: linkMatch[1],
          url: linkMatch[2],
          description: linkMatch[3].trim(),
          category: currentCategory,
        });
      }
    }

    const importedSkills: any[] = [];

    for (const link of skillLinks.slice(0, 50)) {
      const skillId = `github_community_${link.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

      const existing = await db
        .select()
        .from(aiSkillsStore)
        .where(eq(aiSkillsStore.skillId, skillId));

      if (existing.length > 0) continue;

      let content = `# ${link.name}\n\n${link.description}\n\nSource: ${link.url}`;

      const repoMatch = link.url.match(/github\.com\/([^\/]+)\/([^\/\#]+)/);
      if (repoMatch) {
        const skillMd = await fetchGitHubFile(repoMatch[1], repoMatch[2], "SKILL.md");
        if (skillMd) {
          content = skillMd;
        } else {
          const readmeMd = await fetchGitHubFile(repoMatch[1], repoMatch[2], "README.md");
          if (readmeMd) {
            content = readmeMd;
          }
        }
      }

      const [skill] = await db
        .insert(aiSkillsStore)
        .values({
          skillId,
          name: link.name,
          displayTitle: link.name,
          description: link.description,
          source: "github_community",
          category: link.category,
          content,
          metadata: {
            repoUrl: link.url,
            author: repoMatch ? repoMatch[1] : "community",
          },
        })
        .returning();
      importedSkills.push(skill);
    }

    res.json({
      success: true,
      totalLinksFound: skillLinks.length,
      imported: importedSkills.length,
      skills: importedSkills,
    });
  } catch (error: any) {
    console.error("Error importing from GitHub community:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
