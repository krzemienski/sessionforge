import { Twitter, Linkedin, Github, ExternalLink, User } from "lucide-react";

interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

interface BioSectionProps {
  workspaceName: string;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks?: SocialLinks | null;
}

export function BioSection({
  workspaceName,
  bio,
  avatarUrl,
  socialLinks,
}: BioSectionProps) {
  const hasSocialLinks =
    socialLinks &&
    typeof socialLinks === "object" &&
    Object.values(socialLinks).some((url) => url);

  return (
    <div className="mb-12">
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-sf-bg-tertiary border-2 border-sf-border flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${workspaceName} avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={40} className="text-sf-text-muted" />
              )}
            </div>
          </div>

          {/* Bio Content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold font-display mb-3 text-sf-text-primary">
              {workspaceName}
            </h2>

            {bio && (
              <p className="text-base text-sf-text-secondary leading-relaxed whitespace-pre-wrap mb-4">
                {bio}
              </p>
            )}

            {/* Social Links */}
            {hasSocialLinks && (
              <div className="flex flex-wrap gap-3 mt-4">
                {socialLinks.twitter && (
                  <a
                    href={socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary hover:border-sf-accent hover:text-sf-accent transition-colors"
                    title="Twitter"
                  >
                    <Twitter size={16} />
                    <span>Twitter</span>
                  </a>
                )}

                {socialLinks.linkedin && (
                  <a
                    href={socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary hover:border-sf-accent hover:text-sf-accent transition-colors"
                    title="LinkedIn"
                  >
                    <Linkedin size={16} />
                    <span>LinkedIn</span>
                  </a>
                )}

                {socialLinks.github && (
                  <a
                    href={socialLinks.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary hover:border-sf-accent hover:text-sf-accent transition-colors"
                    title="GitHub"
                  >
                    <Github size={16} />
                    <span>GitHub</span>
                  </a>
                )}

                {socialLinks.website && (
                  <a
                    href={socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary hover:border-sf-accent hover:text-sf-accent transition-colors"
                    title="Website"
                  >
                    <ExternalLink size={16} />
                    <span>Website</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
