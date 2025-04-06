import { NewsPreview } from "@/components/news-preview";
import { Button } from "../ui/button";
import { PlusIcon } from "@radix-ui/react-icons";

const mockNews = [
  {
    id: "1",
    title: "Breakthrough in Quantum Computing: Scientists Achieve New Milestone",
    description: "In a groundbreaking development, researchers at the Quantum Technology Institute have successfully demonstrated a new method for maintaining quantum coherence at room temperature...",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    author: {
      name: "Dr. James Wilson",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  },
  {
    id: "2",
    title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
    description: "A groundbreaking AI model has been developed that can understand and generate text in multiple languages, opening up new possibilities for global communication and collaboration...",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    author: {
      name: "Dr. Sarah Chen",
      avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
    },
  },
  {
    id: "3",
    title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
    description: "A groundbreaking AI model has been developed that can understand and generate text in multiple languages, opening up new possibilities for global communication and collaboration...",
    createdAt: new Date(Date.now() - 1231123 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 1212332 * 60 * 60 * 1000),
    author: {
      name: "Dr. Sarah Chen",
      avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
    },
  },
  {
    id: "4",
    title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
    description: "A groundbreaking AI model has been developed that can understand and generate text in multiple languages, opening up new possibilities for global communication and collaboration...",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    author: {
      name: "Dr. Sarah Chen",
      avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
    },
  },
  {
    id: "5",
    title: "Test",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    author: {
      name: "Test Author",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  },
  {
    id: "6",
    title: "Test",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    author: {
      name: "Test Author",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  },
  {
    id: "7",
    title: "Test",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    author: {
      name: "Test Author",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  },
  {
    id: "8",
    title: "Test",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    author: {
      name: "Test Author",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
  }
  // ... add more mock news as needed
];

export function ArticleFeed() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Latest News</h1>
        <Button size="sm" className="flex items-center gap-2" variant="outline">
          <PlusIcon className="h-4 w-4" />
          Create news article
        </Button>
      </div>
      <div className="my-4">
      {mockNews.map((news) => (
        <NewsPreview key={news.id} news={news} />
      ))}
      </div>
    </div>
  );
} 