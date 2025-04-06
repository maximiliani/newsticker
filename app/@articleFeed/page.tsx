import { NewsPreview } from "@/components/news-preview";

const mockNews = [
  {
    id: "1",
    title: "Breakthrough in Quantum Computing: Scientists Achieve New Milestone",
    description: "In a groundbreaking development, researchers at the Quantum Technology Institute have successfully demonstrated a new method for maintaining quantum coherence at room temperature. This breakthrough could potentially revolutionize the field of quantum computing by making quantum computers more practical and accessible. The team's innovative approach involves using a novel material composition that significantly reduces decoherence, one of the major obstacles in quantum computing. The implications of this discovery extend beyond computing, potentially impacting fields such as cryptography, drug discovery, and climate modeling. The research team, led by Dr. Sarah Chen, emphasizes that while there are still challenges to overcome, this development marks a significant step forward in making quantum computing technology viable for real-world applications.",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    author: {
      name: "Dr. James Wilson",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  },
  {
    id: "2",
    title: "Global Climate Summit Announces Ambitious New Targets",
    description: "The 2025 Global Climate Summit concluded today with participating nations agreeing to more aggressive carbon reduction targets than previously established. The new framework, dubbed 'Climate Action 2040', sets forth a comprehensive plan to reduce global emissions by 60% before 2040. This ambitious agreement includes substantial investments in renewable energy infrastructure, commitments to phase out coal power in developed nations by 2035, and establishment of a $100 billion annual fund to assist developing nations in their transition to clean energy. The summit also highlighted innovative technological solutions for carbon capture and storage, with several pilot projects scheduled to launch next year. Environmental experts have praised the new targets while emphasizing the importance of immediate action and international cooperation.",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    author: {
      name: "Emma Thompson",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    },
  },
];

export default function ArticleFeed() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Latest News</h1>
      {mockNews.map((news) => (
        <NewsPreview key={news.id} news={news} />
      ))}
    </div>
  );
} 