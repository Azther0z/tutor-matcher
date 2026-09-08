import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignupPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

function completeSignup({ bio }: { bio?: string } = {}) {
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "supersecret" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "supersecret" },
  });
  if (bio !== undefined) {
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: bio } });
  }
  fireEvent.click(screen.getByLabelText(/I agree to the/));
}

describe("SignupPage", () => {
  it("creates the account and sends the user to the login flow", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 2 }) });
    render(<SignupPage />);
    completeSignup({ bio: "  I teach maths.  " });

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "I teach maths.",
      }),
    });
  });

  it("sends bio as null when left blank", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 3 }) });
    render(<SignupPage />);
    completeSignup();

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        password: "supersecret",
        firstName: "Ada",
        lastName: "Lovelace",
        bio: null,
      }),
    });
  });

  it("blocks submit and shows an error when the name is missing", () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByLabelText(/I agree to the/));

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("First name and last name are required.")).toBeInTheDocument();
  });
});
